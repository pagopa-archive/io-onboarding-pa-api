import { Client } from "@elastic/elasticsearch";
import * as bodyParser from "body-parser";
import * as express from "express";
import {
  Express,
  NextFunction,
  Request,
  RequestHandler,
  Response
} from "express";
import { query, validationResult } from "express-validator";
import { Pool } from "pg";

import { IPA_ELASTICSEARCH_ENDPOINT } from "./config";
import { IIpaSearchResult } from "./types/PublicAdministration";
import { log } from "./utils/logger";

const postgres = new Pool();

function createConnection(db: Pool): Promise<void> {
  return new Promise((resolve, reject) => {
    db.connect((errorConnect, _2, done) => {
      if (errorConnect) {
        return reject(errorConnect);
      }
      resolve();
      done();
    });
  });
}

export default async function newApp(): Promise<Express> {
  // Create Express server
  const app = express();

  // Express configuration
  app.set("port", process.env.PORT || 3000);
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  registerRoutes(app);

  /**
   * Use a custom error-handling middleware function.
   * It intercepts the error forwarded to the `next()` function,
   * logs it and sends to the client a generic error message
   * if no response has been sent yet.
   *
   * @see: http://expressjs.com/en/guide/error-handling.html#writing-error-handlers
   */
  app.use((err: unknown, _1: Request, res: Response, _3: NextFunction) => {
    log.error("%s", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  try {
    await createConnection(postgres);
  } catch (error) {
    log.error("Failed to connect to database. %s", error);
    process.exit(1);
  }
  return app;
}

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

/**
 * Adds an error catching logic to an async middleware.
 * It wraps the execution of the middleware in order to intercept the possible thrown error
 * and to forward it to the error handler middleware through the `next()` function.
 *
 * @see: http://expressjs.com/en/guide/error-handling.html#catching-errors
 *
 * @param { AsyncRequestHandler } func The async middleware to add the error catching logic to.
 * @return { AsyncRequestHandler } The async middleware with the error catching logic.
 */
function asyncHandler(func: AsyncRequestHandler): AsyncRequestHandler {
  return (req: Request, res: Response, next: NextFunction) =>
    func(req, res, next).catch(next);
}

const getPublicAdministrationsHandler: RequestHandler = async (
  req: Request,
  res: Response
) => {
  const validationErrors = validationResult(req);
  if (!validationErrors.isEmpty()) {
    return res.status(400).json(validationErrors.array());
  }
  const searchString = req.query.search;

  const searchParams = {
    body: {
      query: {
        bool: {
          should: [
            {
              nested: {
                path: "office",
                query: {
                  multi_match: {
                    fields: ["office.code", "office.description"],
                    operator: "and",
                    query: searchString
                  }
                }
              }
            },
            {
              multi_match: {
                fields: ["ipa", "description"],
                operator: "and",
                query: searchString
              }
            }
          ]
        }
      }
    },
    index: "indicepa"
  };

  try {
    const client = new Client({ node: IPA_ELASTICSEARCH_ENDPOINT });
    const searchResponse = await client.search(searchParams);
    const publicAdministrations = searchResponse.body.hits.hits
      .map((hit: { _source: IIpaSearchResult }) => hit._source)
      .reduce(
        (
          previous: ReadonlyArray<IIpaSearchResult>,
          current: IIpaSearchResult
        ) => [
          ...previous,
          {
            description: current.description,
            ipa: current.ipa,
            pec: current.pec
          }
        ],
        []
      );
    return res.json(publicAdministrations);
  } catch (error) {
    log.error(error);
    return res.status(500).end(error);
  }
};

function registerRoutes(app: Express): void {
  app.get(
    "/public-administrations",
    [
      query("search")
        .not()
        .isEmpty()
        .withMessage("a value is required")
        .isLength({ min: 3 })
        .withMessage("value must have at least 3 characters")
    ],
    asyncHandler(getPublicAdministrationsHandler)
  );
}

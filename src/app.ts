import axios from "axios";
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

import { log } from "./utils/logger";

import {
  IIpaSearchResponseBody,
  IIpaSearchResult
} from "./types/PublicAdministration";

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

  try {
    await createConnection(postgres);
  } catch (error) {
    log.error("Failed to connect to database. %s", error);
    process.exit(1);
  }
  return app;
}

function asyncHandler(func: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(func(req, res, next)).catch(next);
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
  const requestUrl =
    "https://elasticsearch.developers.italia.it/indicepa/_search";
  const requestBody = {
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
  };
  try {
    const searchResponse = await axios.post<IIpaSearchResponseBody>(
      requestUrl,
      requestBody
    );
    const publicAdministrations = searchResponse.data.hits.hits
      .map(hit => hit._source)
      .reduce(
        (previous: ReadonlyArray<IIpaSearchResult>, current) => [
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

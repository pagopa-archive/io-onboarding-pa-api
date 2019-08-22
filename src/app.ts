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
import { fromNullable } from "fp-ts/lib/Option";
import * as fs from "fs";
import {
  getErrorCodeFromResponse,
  SamlAttribute,
  SpidPassportBuilder
} from "io-spid-commons";
import * as passport from "passport";
import * as path from "path";
import { Sequelize } from "sequelize";
import * as usync from "umzug-sync";

import { IPA_ELASTICSEARCH_ENDPOINT } from "./config";
import sequelize from "./database/db";
import {
  createAssociations as createOrganizationAssociations,
  init as initOrganization
} from "./models/Organization";
import { init as initOrganizationUser } from "./models/OrganizationUser";
import {
  createAssociations as createUserAssociations,
  init as initUser
} from "./models/User";
import { IIpaSearchResult } from "./types/PublicAdministration";
import { log } from "./utils/logger";

// Private key used in SAML authentication to a SPID IDP.
const samlKey = () => {
  const filePath = process.env.SAML_KEY_PATH || "./certs/key.pem";
  log.info("Reading SAML private key file from %s", filePath);
  return fs.readFileSync(filePath, "utf-8");
};

// Public certificate used in SAML authentication to a SPID IDP.
const samlCert = () => {
  const filePath = process.env.SAML_CERT_PATH || "./certs/cert.pem";
  log.info("Reading SAML certificate file from %s", filePath);
  return fs.readFileSync(filePath, "utf-8");
};

export default async function newApp(): Promise<Express> {
  // Create Express server
  const app = express();

  // Express configuration
  app.set("port", process.env.PORT || 3000);
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  app.use(passport.initialize());

  registerRoutes(app);

  // SAML settings.
  const SAML_CALLBACK_URL = process.env.SAML_CALLBACK_URL;
  const SAML_ISSUER = process.env.SAML_ISSUER;
  const SAML_ATTRIBUTE_CONSUMING_SERVICE_INDEX: number = Number(
    process.env.SAML_ATTRIBUTE_CONSUMING_SERVICE_INDEX
  );
  const SAML_ACCEPTED_CLOCK_SKEW_MS = Number(
    process.env.SAML_ACCEPTED_CLOCK_SKEW_MS
  );
  const SPID_AUTOLOGIN = process.env.SPID_AUTOLOGIN;
  const SPID_TESTENV_URL = process.env.SPID_TESTENV_URL;
  const IDP_METADATA_URL = process.env.IDP_METADATA_URL;

  if (
    !IDP_METADATA_URL ||
    !SAML_ACCEPTED_CLOCK_SKEW_MS ||
    !SAML_ATTRIBUTE_CONSUMING_SERVICE_INDEX ||
    !SAML_CALLBACK_URL ||
    !SAML_ISSUER ||
    !SPID_TESTENV_URL
  ) {
    log.error("One or more required environmente variables are missing");
    return process.exit(1);
  }

  try {
    const spidPassport = new SpidPassportBuilder(app, "/login", "/metadata", {
      IDPMetadataUrl: IDP_METADATA_URL,
      organization: {
        URL: "https://io.italia.it",
        displayName:
          "IO onboarding - il portale di onboarding degli enti del progetto IO",
        name:
          "Team per la Trasformazione Digitale - Presidenza Del Consiglio dei Ministri"
      },
      requiredAttributes: [
        SamlAttribute.NAME,
        SamlAttribute.FAMILY_NAME,
        SamlAttribute.EMAIL,
        SamlAttribute.FISCAL_NUMBER
      ],
      samlAcceptedClockSkewMs: SAML_ACCEPTED_CLOCK_SKEW_MS,
      samlAttributeConsumingServiceIndex: SAML_ATTRIBUTE_CONSUMING_SERVICE_INDEX,
      samlCallbackUrl: SAML_CALLBACK_URL,
      samlCert: samlCert(),
      samlIssuer: SAML_ISSUER,
      samlKey: samlKey(),
      spidAutologin: SPID_AUTOLOGIN || "",
      spidTestEnvUrl: SPID_TESTENV_URL
    });
    await spidPassport.init();
    registerLoginRoute(app);
  } catch (error) {
    log.error("Login route registration failed. %s", error);
    process.exit(1);
  }

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
    await usync.migrate({
      SequelizeImport: Sequelize,
      logging: (param: string) => log.info("%s", param),
      migrationsDir: path.join("dist", "migrations"),
      sequelize
    });
    initModels();
    createModelAssociations(); // Models must be already initialized before calling this method
  } catch (error) {
    log.error("Failed to apply migrations. %s", error);
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

/**
 * Initializes SpidStrategy for passport and setup /login route.
 */
function registerLoginRoute(app: Express): void {
  const CLIENT_SPID_ERROR_REDIRECTION_URL =
    process.env.CLIENT_SPID_ERROR_REDIRECTION_URL;
  const CLIENT_SPID_SUCCESS_REDIRECTION_URL =
    process.env.CLIENT_SPID_SUCCESS_REDIRECTION_URL;
  if (
    !CLIENT_SPID_ERROR_REDIRECTION_URL ||
    !CLIENT_SPID_SUCCESS_REDIRECTION_URL
  ) {
    log.error("One or more required environmente variables are missing");
    return process.exit(1);
  }

  app.post("/assertion-consumer-service", (req, res, next) => {
    passport.authenticate("spid", async (err, user) => {
      if (err) {
        log.error("Error in SPID authentication: %s", err);
        return res.redirect(
          CLIENT_SPID_ERROR_REDIRECTION_URL +
            fromNullable(err.statusXml)
              .chain(statusXml => getErrorCodeFromResponse(statusXml))
              .map(errorCode => `?errorCode=${errorCode}`)
              .getOrElse("")
        );
      }
      if (!user) {
        log.error("Error in SPID authentication: no user found");
        return res.redirect(CLIENT_SPID_SUCCESS_REDIRECTION_URL);
      }
      // TODO: handle user data and create token
      log.debug("Spid login success: %s", JSON.stringify(user, null, 4));
      res.json({
        email: user.email,
        familyName: user.familyName,
        fiscalNumber: user.fiscalNumber,
        mobilePhone: user.mobilePhone,
        name: user.name
      });
    })(req, res, next);
  });
}

function initModels(): void {
  initOrganization();
  initOrganizationUser();
  initUser();
}

function createModelAssociations(): void {
  createOrganizationAssociations();
  createUserAssociations();
}

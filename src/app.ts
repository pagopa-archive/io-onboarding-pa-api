import * as bodyParser from "body-parser";
import * as cors from "cors";
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

import { init as initIpaPublicAdministration } from "./models/IpaPublicAdministration";
import {
  createAssociations as createOrganizationAssociations,
  init as initOrganization
} from "./models/Organization";
import { init as initOrganizationUser } from "./models/OrganizationUser";
import {
  createAssociations as createSessionAssociations,
  init as initSession
} from "./models/Session";
import {
  createAssociations as createUserAssociations,
  init as initUser
} from "./models/User";
import { log } from "./utils/logger";

import AuthenticationController from "./controllers/authenticationController";
import ProfileController from "./controllers/profileController";
import { findPublicAdministrationsByName } from "./services/organizationService";
import ProfileService from "./services/profileService";
import SessionStorage from "./services/sessionStorage";
import TokenService from "./services/tokenService";
import bearerTokenStrategy from "./strategies/bearerTokenStrategy";
import { getRequiredEnvVar } from "./utils/environment";
import { toExpressHandler } from "./utils/express";

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

// SAML settings.
const SAML_CALLBACK_URL = getRequiredEnvVar("SAML_CALLBACK_URL");
const SAML_ISSUER = getRequiredEnvVar("SAML_ISSUER");
const SAML_ATTRIBUTE_CONSUMING_SERVICE_INDEX: number = Number(
  getRequiredEnvVar("SAML_ATTRIBUTE_CONSUMING_SERVICE_INDEX")
);
const SAML_ACCEPTED_CLOCK_SKEW_MS = Number(
  getRequiredEnvVar("SAML_ACCEPTED_CLOCK_SKEW_MS")
);
const SPID_AUTOLOGIN = process.env.SPID_AUTOLOGIN;
const SPID_TESTENV_URL = getRequiredEnvVar("SPID_TESTENV_URL");
const IDP_METADATA_URL = getRequiredEnvVar("IDP_METADATA_URL");
const CLIENT_SPID_ERROR_REDIRECTION_URL = getRequiredEnvVar(
  "CLIENT_SPID_ERROR_REDIRECTION_URL"
);
const CLIENT_SPID_SUCCESS_REDIRECTION_URL = getRequiredEnvVar(
  "CLIENT_SPID_SUCCESS_REDIRECTION_URL"
);
const CLIENT_SPID_LOGIN_REDIRECTION_URL = getRequiredEnvVar(
  "CLIENT_SPID_LOGIN_REDIRECTION_URL"
);
const TOKEN_DURATION_IN_SECONDS = Number(
  getRequiredEnvVar("TOKEN_DURATION_IN_SECONDS")
);

export default async function newApp(): Promise<Express> {
  // Create Express server
  const app = express();

  // Express configuration
  app.set("port", process.env.PORT || 3000);
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(
    cors({
      origin: getRequiredEnvVar("CLIENT_DOMAIN")
    })
  );

  passport.use(bearerTokenStrategy());
  app.use(passport.initialize());

  registerRoutes(app);

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

  app.get("/", (_0, res) => {
    res.json({ message: "ok" });
  });

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
  initModels();
  createModelAssociations(); // Models must be already initialized before calling this method
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
  try {
    const foundPublicAdministrations = await findPublicAdministrationsByName(
      req.query.search
    );
    res.json(
      foundPublicAdministrations.map(foundPublicAdministration => {
        return {
          ...foundPublicAdministration,
          links: [
            {
              href: `/public-administrations/${foundPublicAdministration.ipaCode}`,
              rel: "self"
            }
          ]
        };
      })
    );
  } catch (error) {
    log.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

function registerRoutes(app: Express): void {
  const bearerTokenAuth = passport.authenticate("bearer", { session: false });

  const profileController = new ProfileController(new ProfileService());

  app.get(
    `/profile`,
    bearerTokenAuth,
    toExpressHandler(profileController.getProfile, profileController)
  );

  app.put(
    `/profile`,
    bearerTokenAuth,
    toExpressHandler(profileController.editProfile, profileController)
  );

  app.get(
    "/public-administrations",
    [
      query("search")
        .not()
        .isEmpty()
        .withMessage("a value is required")
        .isLength({ min: 3 })
        .withMessage("value must have at least 3 characters")
        .matches(/^[0-9A-Za-z ]*$/)
        .withMessage("value can contain only letters, numbers and spaces")
    ],
    asyncHandler(getPublicAdministrationsHandler)
  );
}

/**
 * Setup SPID authentication routes.
 */
function registerLoginRoute(app: Express): void {
  // Creates the authentication controller,
  // which provides methods to log the user in and out,
  // handling the related session token accordingly
  const authController = new AuthenticationController(
    new SessionStorage(),
    new TokenService(),
    TOKEN_DURATION_IN_SECONDS,
    CLIENT_SPID_ERROR_REDIRECTION_URL,
    CLIENT_SPID_SUCCESS_REDIRECTION_URL
  );

  // Handle the SAML assertion got from the IdP server
  app.post("/assertion-consumer-service", (req, res, next) => {
    passport.authenticate("spid", async (err, user) => {
      // If an error occurs then redirects the client to CLIENT_SPID_ERROR_REDIRECTION_URL
      // appending the error code to the url as a parameter
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
      // If no assertion has been returned then redirects the client to CLIENT_SPID_LOGIN_REDIRECTION_URL
      if (!user) {
        log.error("Error in SPID authentication: no user found");
        return res.redirect(CLIENT_SPID_LOGIN_REDIRECTION_URL);
      }
      // The assertion is processed by the assertion consumer service
      // and a response is sent to the client
      const response = await authController.acs(user);
      response.apply(res);
    })(req, res, next);
  });

  const bearerTokenAuth = passport.authenticate("bearer", { session: false });

  app.post(
    "/logout",
    bearerTokenAuth,
    toExpressHandler(authController.logout, authController)
  );

  app.post("/slo", toExpressHandler(authController.slo, authController));
}

function initModels(): void {
  initIpaPublicAdministration();
  initOrganization();
  initOrganizationUser();
  initUser();
  initSession();
}

function createModelAssociations(): void {
  createOrganizationAssociations();
  createUserAssociations();
  createSessionAssociations();
}

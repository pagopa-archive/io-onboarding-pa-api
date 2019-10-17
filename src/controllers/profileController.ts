import * as express from "express";
import {
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import { EmailString } from "italia-ts-commons/lib/strings";
import EmailService from "../services/emailService";
import ProfileService from "../services/profileService";

import { UserProfile } from "../generated/UserProfile";
import { withUserFromRequest } from "../types/user";
import { getRequiredEnvVar } from "../utils/environment";
import { log } from "../utils/logger";
import { withValidatedOrValidationError } from "../utils/responses";

export default class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly emailService: EmailService
  ) {}

  /**
   * Returns the user profile information.
   */
  public getProfile(
    req: express.Request
  ): Promise<
    | IResponseSuccessJson<UserProfile>
    | IResponseErrorValidation
    | IResponseErrorInternal
  > {
    return withUserFromRequest(req, async user =>
      this.profileService.getProfile(user)
    );
  }

  /**
   * Edits the user information
   */
  public editProfile(
    req: express.Request
  ): Promise<
    // tslint:disable-next-line:max-union-size
    | IResponseSuccessJson<UserProfile>
    | IResponseErrorValidation
    | IResponseErrorNotFound
    | IResponseErrorInternal
  > {
    return withUserFromRequest(req, async user =>
      withValidatedOrValidationError(
        EmailString.decode(req.body.work_email),
        async workEmail => {
          const errorResponseOrSuccessResponse = await this.profileService.updateProfile(
            user,
            workEmail
          );
          log.info(
            "errorResponseOrSuccessResponse: %s",
            JSON.stringify(errorResponseOrSuccessResponse, null, 4)
          );
          log.info(
            "typeof errorResponseOrSuccessResponse: %s",
            typeof errorResponseOrSuccessResponse
          );
          return errorResponseOrSuccessResponse.map(response => {
            const emailText = `Ciao ${user.givenName},
la tua email di lavoro è stata modificata con successo, da questo momento riceverai le comunicazioni al nuovo indirizzo da te scelto.`;
            // tslint:disable-next-line:no-floating-promises
            this.emailService
              .send({
                from: getRequiredEnvVar("EMAIL_SENDER"),
                html: emailText,
                subject: "Modifica dell'email di lavoro",
                text: emailText,
                to: workEmail
              })
              .then(maybeError =>
                maybeError.map(error =>
                  log.error(
                    "Failed to send email notification for work email change. %s",
                    error
                  )
                )
              );
            return response;
          }).value;
        }
      )
    );
  }
}

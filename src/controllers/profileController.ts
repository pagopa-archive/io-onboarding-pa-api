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
import localeIt from "../locales/it";
import { withUserFromRequest } from "../types/user";
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
          return errorResponseOrSuccessResponse.map(response => {
            if (response.value.work_email !== response.value.email) {
              const emailText = localeIt.profileController.editProfile.notificationEmail.content.replace(
                "%s",
                user.givenName
              );
              // TODO:
              //  refactor this kind of tasks with some external asynchronous worker processes linked to a shared queue.
              //  @see https://www.pivotaltracker.com/story/show/169620861
              this.emailService
                .send({
                  html: emailText,
                  subject:
                    localeIt.profileController.editProfile.notificationEmail
                      .subject,
                  text: emailText,
                  to: workEmail
                })
                .catch(error =>
                  log.error(
                    "Failed to send email notification for work email change. %s",
                    error
                  )
                );
            }
            return response;
          }).value;
        }
      )
    );
  }
}

import * as express from "express";
import {
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import { EmailString } from "italia-ts-commons/lib/strings";
import ProfileService from "../services/profileService";

import { UserProfile } from "../generated/UserProfile";
import { withUserFromRequest } from "../types/user";
import { withValidatedOrValidationError } from "../utils/responses";

export default class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

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
        workEmail => this.profileService.updateProfile(user, workEmail)
      )
    );
  }
}

/**
 * This service retrieves and updates the user profile information
 */

import * as t from "io-ts";
import {
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseSuccessJson,
  ResponseErrorNotFound,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import { EmailString } from "italia-ts-commons/lib/strings";

import { User } from "../models/User";
import { UserProfile } from "../types/profile";
import { LoggedUser } from "../types/user";
import {
  withCatchAsInternalError,
  withValidatedOrInternalError
} from "../utils/responses";

export default class ProfileService {
  /**
   * Updates the working email of a user.
   */
  public async updateProfile(
    user: LoggedUser,
    workEmail: EmailString
  ): Promise<
    | IResponseErrorInternal
    | IResponseErrorNotFound
    | IResponseSuccessJson<UserProfile>
  > {
    return withCatchAsInternalError(async () => {
      const userInstance = await User.findByPk(user.email);
      if (userInstance === null) {
        return ResponseErrorNotFound(
          "Not found",
          "Could not find the user in the database"
        );
      }
      const updatedUser = await userInstance.update({ workEmail });
      return withValidatedOrInternalError(
        t.exact(UserProfile).decode(updatedUser.get({ plain: true })),
        updatedProfile => {
          return ResponseSuccessJson(updatedProfile);
        }
      );
    });
  }
}

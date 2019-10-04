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

import { UserProfile } from "../generated/UserProfile";
import { User } from "../models/User";
import { LoggedUser } from "../types/user";
import {
  withCatchAsInternalError,
  withValidatedOrInternalError
} from "../utils/responses";

export default class ProfileService {
  /**
   * Returns the user profile information.
   */
  public async getProfile(
    user: LoggedUser
  ): Promise<IResponseErrorInternal | IResponseSuccessJson<UserProfile>> {
    return withValidatedOrInternalError(
      t.exact(UserProfile).decode(user),
      userProfile => {
        return ResponseSuccessJson(userProfile);
      }
    );
  }

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
      const userInstance = await User.findOne({
        // We use User.findOne() because User.findByPk() throws error on tests execution
        where: { email: user.email }
      });
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

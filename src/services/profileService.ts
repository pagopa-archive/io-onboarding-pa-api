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
      t.exact(UserProfile).decode({
        email: user.email,
        family_name: user.familyName,
        fiscal_code: user.fiscalCode,
        given_name: user.givenName,
        role: user.role,
        work_email: user.workEmail
      }),
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
        t.exact(UserProfile).decode({
          email: updatedUser.email,
          family_name: updatedUser.familyName,
          fiscal_code: updatedUser.fiscalCode,
          given_name: updatedUser.givenName,
          role: updatedUser.role,
          work_email: updatedUser.workEmail ? updatedUser.workEmail : undefined
        }),
        updatedProfile => {
          return ResponseSuccessJson(updatedProfile);
        }
      );
    });
  }
}

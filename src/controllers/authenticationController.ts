/**
 * This controller handles the call from the IDP after a successful
 * authentication. In the request headers there are all the attributes sent from
 * the IDP.
 */

import { Request } from "express";
import { isLeft } from "fp-ts/lib/Either";
import {
  IResponseErrorInternal,
  IResponseErrorValidation,
  IResponsePermanentRedirect,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseErrorValidation,
  ResponsePermanentRedirect,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import { UrlFromString } from "italia-ts-commons/lib/url";

import SessionStorage from "../services/sessionStorage";
import TokenService from "../services/tokenService";
import { SuccessResponse } from "../types/commons";
import { validateSpidUser, withUserFromRequest } from "../types/spidUser";
import { SessionToken } from "../types/token";
import { log } from "../utils/logger";
import { withCatchAsInternalError } from "../utils/responses";

export default class AuthenticationController {
  constructor(
    private readonly tokenService: TokenService,
    private readonly getClientProfileRedirectionUrl: (
      token: string
    ) => UrlFromString
  ) {}

  /**
   * The Assertion consumer service.
   */
  public async acs(
    // tslint:disable-next-line:no-any
    userPayload: unknown
  ): Promise<
    | IResponseErrorInternal
    | IResponseErrorValidation
    | IResponsePermanentRedirect
  > {
    const errorOrUser = validateSpidUser(userPayload);

    if (isLeft(errorOrUser)) {
      log.error(
        "Error validating the SPID user %O: %s",
        userPayload,
        errorOrUser.value
      );
      return ResponseErrorValidation("Bad request", errorOrUser.value);
    }

    const spidUser = errorOrUser.value;
    const sessionToken = this.tokenService.getNewToken() as SessionToken;

    const errorOrResponse = await SessionStorage.set(spidUser, sessionToken);

    if (isLeft(errorOrResponse)) {
      const error = errorOrResponse.value;
      log.error("Error storing the user in the session: %s", error.message);
      return ResponseErrorInternal(error.message);
    }
    const response = errorOrResponse.value;

    if (!response) {
      log.error("Error storing the user in the session");
      return ResponseErrorInternal("Error creating the user session");
    }
    const urlWithToken = this.getClientProfileRedirectionUrl(sessionToken);

    return ResponsePermanentRedirect(urlWithToken);
  }
  /**
   * Retrieves the logout url from the IDP.
   */
  public async logout(
    req: Request
  ): Promise<
    | IResponseErrorInternal
    | IResponseErrorValidation
    | IResponseSuccessJson<SuccessResponse>
  > {
    return withUserFromRequest(req, user =>
      withCatchAsInternalError(async () => {
        const errorOrResponse = await SessionStorage.del(user.sessionToken);

        if (isLeft(errorOrResponse)) {
          const error = errorOrResponse.value;
          return ResponseErrorInternal(error.message);
        }

        const response = errorOrResponse.value;

        if (!response) {
          return ResponseErrorInternal("Error destroying the user session");
        }

        return ResponseSuccessJson({ message: "ok" });
      })
    );
  }

  /**
   * The Single logout service.
   */
  public async slo(): Promise<IResponsePermanentRedirect> {
    const url: UrlFromString = {
      href: "/"
    };

    return ResponsePermanentRedirect(url);
  }
}

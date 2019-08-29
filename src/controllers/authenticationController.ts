/**
 * This controller handles the call from the IDP after a successful
 * authentication. In the request headers there are all the attributes sent from
 * the IDP.
 */

import { Request, Response } from "express";
import { isLeft } from "fp-ts/lib/Either";
import { isSome } from "fp-ts/lib/Option";
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
import { SessionToken } from "../types/token";
import { validateSpidUser, withUserFromRequest } from "../types/user";
import { log } from "../utils/logger";
import { withCatchAsInternalError } from "../utils/responses";

export default class AuthenticationController {
  constructor(
    private readonly sessionStorage: SessionStorage,
    private readonly tokenService: TokenService,
    private readonly tokenDurationInSeconds: number,
    private readonly clientSpidAccessRedirectionUrl: string
  ) {}

  /**
   * The Assertion consumer service.
   * It validates the assertion got by the IdP server,
   * then creates a token and store a new session for the user
   * and returns the response to be sent to the client
   */
  public async acs(
    // tslint:disable-next-line:no-any
    userPayload: unknown,
    res: Response
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

    const maybeError = await this.sessionStorage.set(
      spidUser,
      sessionToken,
      this.tokenDurationInSeconds
    );

    if (isSome(maybeError)) {
      const error = maybeError.value;
      log.error("Error storing the user in the session: %s", error.message);
      return ResponseErrorInternal(error.message);
    }
    res.cookie("sessionToken", sessionToken, {
      maxAge: this.tokenDurationInSeconds
    });

    return ResponsePermanentRedirect({
      href: this.clientSpidAccessRedirectionUrl
    });
  }
  /**
   * Deletes the user session, so that its token can not be used anymore
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
        const maybeError = await this.sessionStorage.del(user.session.token);

        if (isSome(maybeError)) {
          const error = maybeError.value;
          return ResponseErrorInternal(error.message);
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

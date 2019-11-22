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
  ResponseErrorInternal,
  ResponseErrorValidation,
  ResponsePermanentRedirect
} from "italia-ts-commons/lib/responses";
import { UrlFromString } from "italia-ts-commons/lib/url";

import SessionStorage from "../services/sessionStorage";
import TokenService from "../services/tokenService";
import { SessionToken } from "../types/token";
import { validateSpidUser, withUserFromRequest } from "../types/user";
import { getRequiredEnvVar } from "../utils/environment";
import { log } from "../utils/logger";
import {
  IResponseNoContent,
  ResponseNoContent,
  withCatchAsInternalError
} from "../utils/responses";

export default class AuthenticationController {
  constructor(
    private readonly sessionStorage: SessionStorage,
    private readonly tokenService: TokenService,
    private readonly tokenDurationInSeconds: number,
    private readonly clientSpidErrorRedirectionUrl: string,
    private readonly clientSpidAccessRedirectionUrl: string
  ) {}

  /**
   * The Assertion consumer service.
   * It validates the assertion got by the IdP server,
   * then creates a token and store a new session for the user
   * and returns the response to be sent to the client
   */
  public async acs(
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

    const maybeError = await this.sessionStorage.set(
      spidUser,
      sessionToken,
      this.tokenDurationInSeconds
    );

    if (isSome(maybeError)) {
      const error = maybeError.value;
      log.error("Error storing the user in the session: %s", error.message);
      return ResponsePermanentRedirect({
        href: this.clientSpidErrorRedirectionUrl
      });
    }

    const redirectResponse = ResponsePermanentRedirect({
      href: this.clientSpidAccessRedirectionUrl
    });

    const withCookie = (res: Response) =>
      res.cookie("sessionToken", sessionToken, {
        domain: getRequiredEnvVar("COOKIE_DOMAIN"),
        maxAge: this.tokenDurationInSeconds * 1000 // Express requires a value in ms
      });

    return {
      ...redirectResponse,
      apply: res => redirectResponse.apply(withCookie(res))
    };
  }
  /**
   * Deletes the user session, so that its token can not be used anymore
   */
  public async logout(
    req: Request
  ): Promise<
    IResponseErrorInternal | IResponseErrorValidation | IResponseNoContent
  > {
    return withUserFromRequest(req, user =>
      withCatchAsInternalError(async () => {
        const maybeError = await this.sessionStorage.del(user.session.token);

        if (isSome(maybeError)) {
          const error = maybeError.value;
          return ResponseErrorInternal(error.message);
        }

        return ResponseNoContent();
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

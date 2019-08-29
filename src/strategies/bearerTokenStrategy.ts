/**
 * Builds and configure a Passport strategy to authenticate the proxy clients.
 */

import * as express from "express";
import * as passport from "passport-http-bearer";
import { IVerifyOptions } from "passport-http-bearer";
import SessionStorage from "../services/sessionStorage";
import { SessionToken } from "../types/token";

const bearerTokenStrategy = (APIBasePath: string) => {
  const options = {
    passReqToCallback: true,
    realm: "",
    scope: ""
  };
  return new passport.Strategy(options, (
    req: express.Request,
    token: string,
    // tslint:disable-next-line:no-any
    done: (error: any, user?: any, options?: IVerifyOptions | string) => void
  ) => {
    const path = req.route.path;

    if (
      path === "/logout" || // We need to use this strategy with the SessionToken also for `/logout` path
      path.startsWith(APIBasePath)
    ) {
      new SessionStorage().getBySessionToken(token as SessionToken).then(
        errorOrUser => {
          errorOrUser.fold(
            () => done(undefined, false),
            user =>
              done(
                undefined,
                user.session.expirationTime.valueOf() > Date.now()
                  ? user
                  : false
              )
          );
        },
        () => {
          done(undefined, false);
        }
      );
    } else {
      done(undefined, false);
    }
  });
};

export default bearerTokenStrategy;

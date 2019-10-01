/**
 * Builds and configure a Passport strategy to authenticate the proxy clients.
 */

import * as passport from "passport-http-bearer";
import { IVerifyOptions } from "passport-http-bearer";
import SessionStorage from "../services/sessionStorage";
import { SessionToken } from "../types/token";

const bearerTokenStrategy = () => {
  return new passport.Strategy((
    token: string,
    // tslint:disable-next-line:no-any
    done: (error: any, user?: any, options?: IVerifyOptions | string) => void
  ) => {
    new SessionStorage().getBySessionToken(token as SessionToken).then(
      errorOrUser => {
        errorOrUser.fold(
          () => done(undefined, false),
          user =>
            done(
              undefined,
              user.session.expirationTime.valueOf() > Date.now() ? user : false
            )
        );
      },
      () => {
        done(undefined, false);
      }
    );
  });
};

export default bearerTokenStrategy;

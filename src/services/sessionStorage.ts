import { Either, isLeft, left, right } from "fp-ts/lib/Either";
import { Op } from "sequelize";
import { Session } from "../models/Session";
import { User } from "../models/User";
import { SpidLoggedUser, SpidUser } from "../types/spidUser";
import { SessionToken } from "../types/token";
import { getRequiredEnvVar } from "../utils/environment";
import { log } from "../utils/logger";

export const sessionNotFoundError = new Error("Session not found");

export default class SessionStorage {
  public static async set(
    user: SpidUser,
    sessionToken: SessionToken
  ): Promise<Either<Error, boolean>> {
    const TOKEN_DURATION_IN_SECONDS = Number(
      getRequiredEnvVar("TOKEN_DURATION_IN_SECONDS")
    );
    if (!TOKEN_DURATION_IN_SECONDS) {
      log.error("TOKEN_DURATION_IN_SECONDS environment variable is missing");
      return process.exit(1);
    }

    try {
      const [loggerUser, _] = await User.findOrCreate({
        defaults: {
          email: user.email,
          familyName: user.familyName,
          firstName: user.name
        },
        where: { fiscalCode: user.fiscalNumber }
      });
      await loggerUser.createSession({
        expirationTime: new Date(Date.now() + TOKEN_DURATION_IN_SECONDS),
        token: sessionToken
      });
    } catch (error) {
      return left<Error, boolean>(
        new Error("Error creating session for the user")
      );
    }
    return right<Error, boolean>(true);
  }

  /**
   * {@inheritDoc}
   */
  public static async getBySessionToken(
    token: SessionToken
  ): Promise<Either<Error, User>> {
    const errorOrSession = await this.loadSessionBySessionToken(token);

    if (isLeft(errorOrSession)) {
      const error = errorOrSession.value;
      return left(error);
    }

    const user = errorOrSession.value;

    return right(user);
  }

  /**
   * {@inheritDoc}
   */
  public static async del(
    sessionToken: SessionToken
  ): Promise<Either<Error, boolean>> {
    try {
      const session = await Session.findOne({ where: { token: sessionToken } });
      if (!session) {
        return left<Error, boolean>(sessionNotFoundError);
      }
      await session.destroy();
      return right<Error, boolean>(true);
    } catch (error) {
      return left<Error, boolean>(new Error("Error deleting the token"));
    }
  }

  public static async listUserSessions(
    user: SpidLoggedUser
  ): Promise<Either<Error, ReadonlyArray<Session>>> {
    try {
      const userWithSessions = await User.findOne({
        include: [
          {
            as: "sessions",
            model: Session,
            where: {
              deletedAt: null,
              expirationTime: {
                [Op.lt]: new Date()
              }
            }
          }
        ],
        where: {
          fiscalCode: user.fiscalCode
        }
      });
      if (!userWithSessions || !Array.isArray(userWithSessions.sessions)) {
        return right([]);
      }
      return right(userWithSessions.sessions);
    } catch (error) {
      return left(error);
    }
  }

  /**
   * Return a Session for this token.
   */
  private static async loadSessionBySessionToken(
    token: SessionToken
  ): Promise<Either<Error, User>> {
    try {
      const user = await User.findOne({
        include: [{ as: "session", model: Session, where: { token } }]
      });
      if (user === null) {
        return left<Error, User>(sessionNotFoundError);
      }
      return right<Error, User>(user);
    } catch (error) {
      return left<Error, User>(error);
    }
  }
}

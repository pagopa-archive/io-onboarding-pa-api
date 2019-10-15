import { Either, left, right } from "fp-ts/lib/Either";
import { none, Option, some } from "fp-ts/lib/Option";
import { Op } from "sequelize";
import { UserRoleEnum } from "../generated/UserRole";
import { Session } from "../models/Session";
import { User } from "../models/User";
import { SessionToken } from "../types/token";
import { LoggedUser, SpidUser } from "../types/user";

export const sessionNotFoundError = new Error("Session not found");

export default class SessionStorage {
  public async set(
    user: SpidUser,
    sessionToken: SessionToken,
    tokenDurationInSeconds: number
  ): Promise<Option<Error>> {
    try {
      const [loggerUser, _] = await User.findOrCreate({
        defaults: {
          familyName: user.familyName,
          fiscalCode: user.fiscalNumber,
          givenName: user.name,
          role: UserRoleEnum.ORG_DELEGATE
        },
        where: { email: user.email }
      });
      await loggerUser.createSession({
        expirationTime: new Date(Date.now() + tokenDurationInSeconds * 1000),
        token: sessionToken
      });
    } catch (error) {
      return some<Error>(error);
    }
    return none;
  }

  public async getBySessionToken(
    token: SessionToken
  ): Promise<Either<Error, LoggedUser>> {
    try {
      const user = await User.findOne({
        include: [{ as: "session", model: Session, where: { token } }]
      });
      if (user === null) {
        return left<Error, LoggedUser>(sessionNotFoundError);
      }
      const loggedUserOrError = LoggedUser.decode({
        ...user.get({ plain: true }),
        workEmail: user.workEmail ? user.workEmail : undefined
      });
      return loggedUserOrError.isRight()
        ? right(loggedUserOrError.value)
        : left(new Error("User is not a valid object"));
    } catch (error) {
      return left<Error, LoggedUser>(error);
    }
  }

  public async del(sessionToken: SessionToken): Promise<Option<Error>> {
    try {
      const session = await Session.findByPk(sessionToken);
      if (!session) {
        return some(sessionNotFoundError);
      }
      await session.destroy();
      return none;
    } catch (error) {
      return some(new Error("Error destroying the user session"));
    }
  }

  public async listUserActiveSessions(
    user: LoggedUser
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
          email: user.email
        }
      });
      if (!userWithSessions) {
        return left(new Error("User not found"));
      }
      return right(userWithSessions.sessions ? userWithSessions.sessions : []);
    } catch (error) {
      return left(error);
    }
  }
}

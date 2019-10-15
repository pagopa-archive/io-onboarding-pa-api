import { isNone, isSome } from "fp-ts/lib/Option";
import { SpidLevelEnum } from "io-spid-commons";
import { EmailString, FiscalCode } from "italia-ts-commons/lib/strings";
import * as SequelizeMock from "sequelize-mock";
import { UserRoleEnum } from "../../generated/UserRole";
import { SessionToken } from "../../types/token";
import { LoggedUser, SpidUser } from "../../types/user";
import TokenService from "../tokenService";

const dbMock = new SequelizeMock();

const aValidToken = new TokenService().getNewToken() as SessionToken;
const anInvalidToken = "invalid_token" as SessionToken;
const aTokenThrowingError = "throw_error" as SessionToken;
const anEmail = "asd@email.net" as EmailString;
const aFiscalCode = "AAABBB11C22D333E" as FiscalCode;
const dbErrorString = "db error";

const mockedSession1 = {
  createdAt: new Date(),
  deletedAt: null,
  email: anEmail,
  expirationTime: new Date(Date.now() + 3600000),
  token: aValidToken
};

const mockedSession2 = {
  createdAt: new Date(),
  deletedAt: null,
  email: anEmail,
  expirationTime: new Date(Date.now() + 3600000),
  token: aValidToken
};

const mockedSpidUser: SpidUser = {
  authnContextClassRef: SpidLevelEnum["https://www.spid.gov.it/SpidL2"],
  email: anEmail,
  familyName: "Garibaldi",
  fiscalNumber: aFiscalCode,
  getAssertionXml: () => "",
  issuer: { _: "onelogin_saml" },
  name: "Giuseppe Maria"
};

const mockedUserAttributes = {
  email: mockedSpidUser.email,
  familyName: mockedSpidUser.familyName,
  fiscalCode: mockedSpidUser.fiscalNumber,
  givenName: mockedSpidUser.name,
  role: UserRoleEnum.ORG_DELEGATE
};

const mockedUserModel = dbMock.define("user", mockedUserAttributes, {
  instanceMethods: {
    createSession: (params: { expirationTime: number; token: SessionToken }) =>
      params.token === aTokenThrowingError
        ? Promise.reject(new Error("error"))
        : Promise.resolve()
  }
});

mockedUserModel.$queryInterface.$useHandler(
  // tslint:disable-next-line:no-any
  (query: string, queryOptions: any) => {
    if (query === "findOne") {
      if (queryOptions && Array.isArray(queryOptions[0].include)) {
        const includeOpts = queryOptions[0].include[0];
        if (includeOpts.as === "session" && includeOpts.where) {
          if (includeOpts.where.token === aValidToken) {
            return mockedUserModel.build({
              ...mockedUserAttributes,
              session: {
                ...mockedSession1,
                token:
                  includeOpts.where.token === anInvalidToken
                    ? anInvalidToken
                    : aValidToken
              }
            });
          } else if (includeOpts.where.token === aTokenThrowingError) {
            throw new Error(dbErrorString);
          } else {
            return null;
          }
        }
        if (
          includeOpts.as === "sessions" &&
          includeOpts.where.expirationTime &&
          includeOpts.where.deletedAt === null
        ) {
          return mockedUserModel.build({
            ...mockedUserAttributes,
            sessions: [mockedSession1, mockedSession2]
          });
        }
      }
      return null;
    }
    if (query === "findOrCreate") {
      return [mockedUserModel.build(mockedUserAttributes), true];
    }
    return null;
  }
);

const mockedSessionModel = dbMock.define("session", {
  createdAt: new Date(),
  deletedAt: null,
  email: anEmail,
  expirationTime: new Date(Date.now() + 3600000),
  token: aValidToken
});

jest.mock("../../models/User", () => ({
  User: mockedUserModel
}));
jest.mock("../../models/Session", () => () => ({
  Session: mockedSessionModel
}));

import SessionStorage from "../sessionStorage";

const sessionStorage = new SessionStorage();

describe("Session storage", () => {
  describe("#getBySessionToken()", () => {
    it("should return a user with a session when a valid token is provided", async () => {
      const result = await sessionStorage.getBySessionToken(aValidToken);
      expect(result).not.toBeNull();
      expect(LoggedUser.decode(result.value).isRight()).toBeTruthy();
    });

    it("should return an error when an invalid token is provided", async () => {
      const result = await sessionStorage.getBySessionToken(anInvalidToken);
      expect(LoggedUser.decode(result.value).isRight()).toBeFalsy();
    });

    it("should return an error when the db throws an error", async () => {
      const result = await sessionStorage.getBySessionToken(
        aTokenThrowingError
      );
      expect(result.isLeft()).toBeTruthy();
    });
  });

  describe("#set()", () => {
    it("should return none if no error occurs", async () => {
      const result = await sessionStorage.set(mockedSpidUser, aValidToken, 1);
      expect(isNone(result)).toBeTruthy();
    });

    it("should return some error if an error occurs", async () => {
      const result = await sessionStorage.set(
        mockedSpidUser,
        aTokenThrowingError,
        300
      );
      expect(isSome(result)).toBeTruthy();
    });
  });
});

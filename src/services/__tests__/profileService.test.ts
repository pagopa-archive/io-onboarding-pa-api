import * as t from "io-ts";
import { EmailString, FiscalCode } from "italia-ts-commons/lib/strings";
import * as SequelizeMock from "sequelize-mock";
import { UserProfile } from "../../types/profile";
import { NotClosedSession } from "../../types/session";
import { LoggedUser, UserRoleEnum } from "../../types/user";

const anEmail = "asd@email.net" as EmailString;
const aFiscalCode = "AAABBB11C22D333E" as FiscalCode;
const aFirstName = "Giuseppe";
const aFamilyName = "Garibaldi";
const emailOfNotExistingUser = "not-existing-user" as EmailString;
const anEmailThrowingErrorOnFind = "throw_error_on_find" as EmailString;
const anEmailThrowingErrorOnUpdate = "throw_error_on_update" as EmailString;
const dbErrorString = "db error";

// mock for a valid logged user
const mockedLoggedUser: LoggedUser = {
  createdAt: new Date(),
  email: anEmail,
  familyName: aFamilyName,
  firstName: aFirstName,
  fiscalCode: aFiscalCode,
  role: UserRoleEnum.ORG_DELEGATE,
  session: {} as NotClosedSession,
  workEmail: null
} as LoggedUser;

const mockedUserAttributes: UserProfile = {
  email: anEmail,
  familyName: aFamilyName,
  firstName: aFirstName,
  fiscalCode: aFiscalCode,
  role: UserRoleEnum.ORG_DELEGATE,
  workEmail: null
};

const dbMock = new SequelizeMock();

const mockedUserModel = dbMock.define("users", mockedUserAttributes, {
  instanceMethods: {
    update: (params: { workEmail: EmailString }) =>
      params.workEmail === anEmailThrowingErrorOnUpdate
        ? Promise.reject(new Error("error"))
        : Promise.resolve(
            mockedUserModel.build({
              ...mockedUserAttributes,
              workEmail: params.workEmail
            })
          )
  }
});

mockedUserModel.$queryInterface.$useHandler(
  // tslint:disable-next-line:no-any
  (query: string, queryOptions: any) => {
    if (query === "findOne") {
      if (queryOptions && queryOptions[0].where.email) {
        const userPK = queryOptions[0].where.email;
        if (userPK === emailOfNotExistingUser) {
          return null;
        }
        if (userPK === anEmailThrowingErrorOnFind) {
          throw new Error(dbErrorString);
        }
        return mockedUserModel.build(mockedUserAttributes);
      }
      return null;
    }
    return null;
  }
);

jest.mock("../../models/User", () => ({
  User: mockedUserModel
}));

afterEach(async () => {
  mockedUserModel.$queryInterface.$clearQueue();
});

import ProfileService from "../profileService";
const profileService = new ProfileService();

describe("Profile service", () => {
  describe("#getProfile()", () => {
    it("should return a success response with the user profile if the user is a valid object", async () => {
      const result = await profileService.getProfile(mockedLoggedUser);
      const expectedResponseBody = t.exact(UserProfile).decode(mockedLoggedUser)
        .value;
      expect(result).not.toBeNull();
      expect(result).toHaveProperty("kind", "IResponseSuccessJson");
      expect(result).toHaveProperty("value", expectedResponseBody);
    });
  });
  describe("#updateProfile()", () => {
    it("should return a success response with an updated user profile if the user exists", async () => {
      const newEmail = "new@email.net" as EmailString;
      const result = await profileService.updateProfile(
        mockedLoggedUser,
        newEmail
      );
      expect(result).not.toBeNull();
      expect(result).toEqual({
        apply: expect.any(Function),
        kind: "IResponseSuccessJson",
        value: {
          ...mockedUserAttributes,
          workEmail: newEmail
        }
      });
    });

    it("should return a not found error response if the user does not exists", async () => {
      const result = await profileService.updateProfile(
        { ...mockedLoggedUser, email: emailOfNotExistingUser },
        anEmail
      );
      expect(result).toHaveProperty("apply", expect.any(Function));
      expect(result).toHaveProperty("kind", "IResponseErrorNotFound");
    });

    it("should return an internal error response if the db throws an error", async () => {
      const result = await profileService.updateProfile(
        mockedLoggedUser,
        anEmailThrowingErrorOnFind
      );
      expect(result).toHaveProperty("apply", expect.any(Function));
      expect(result).toHaveProperty("kind", "IResponseErrorInternal");
    });
  });
});

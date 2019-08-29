import { SpidLevelEnum } from "io-spid-commons";
import { EmailString, FiscalCode } from "italia-ts-commons/lib/strings";
import mockReq from "../../__mocks__/request";

import { SessionToken } from "../token";
import { LoggedUser, SpidUser, validateSpidUser } from "../user";

const tokenDurationInSeconds = 300;

const aValidFiscalNumber = "GRBGPP87L04L741X" as FiscalCode;
const aValidEmailAddress = "x@example.com" as EmailString;
const anIssuer = { _: "onelogin_saml" };

const aValidSpidLevel = SpidLevelEnum["https://www.spid.gov.it/SpidL2"];

// mock for a valid SpidUser
const mockedSpidUser: SpidUser = {
  authnContextClassRef: aValidSpidLevel,
  email: aValidEmailAddress,
  familyName: "Garibaldi",
  fiscalNumber: aValidFiscalNumber,
  getAssertionXml: () => "",
  issuer: anIssuer,
  name: "Giuseppe Maria"
};

// mock for an invalid SpidUser
const mockedInvalidSpidUser = {
  aKey: "aValue"
};

// mock for a valid logged user
const mockedUser: LoggedUser = {
  createdAt: new Date(),
  email: aValidEmailAddress,
  familyName: "Garibaldi",
  firstName: "Giuseppe Maria",
  fiscalCode: aValidFiscalNumber,
  session: {
    createdAt: new Date(),
    deletedAt: null,
    expirationTime: new Date(Date.now() + tokenDurationInSeconds * 1000),
    fiscalCode: aValidFiscalNumber,
    token: "HexToKen" as SessionToken
  }
};

describe("user type", () => {
  /* test case: extract user info from Express request */
  it("should get a user from Express request", done => {
    // Express request mock
    const req = mockReq();

    // populate mock request with User
    req.user = mockedUser;

    // extract the user data from Express request
    const userData = LoggedUser.decode(req.user);

    expect(userData.isRight()).toBeTruthy();
    if (userData.isRight()) {
      expect(userData._tag).toBe("Right");
      expect(userData.value).toBe(req.user);
    }
    done();
  });

  it("should correctly validate Spid user info with validateSpidUser", done => {
    // Validate correct SpidUser. Return right.
    const userDataOK = validateSpidUser(mockedSpidUser);

    expect(userDataOK.isRight()).toBeTruthy();
    if (userDataOK.isRight()) {
      expect(userDataOK._tag).toBe("Right");
    }

    // Validate incorrect SpidUser(User). Return left.
    const userDataKO = validateSpidUser(mockedInvalidSpidUser);

    expect(userDataKO.isLeft()).toBeTruthy();
    if (userDataKO.isLeft()) {
      expect(userDataKO._tag).toBe("Left");
    }
    done();
  });
});

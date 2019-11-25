/* tslint:disable:no-let */

import { none, some } from "fp-ts/lib/Option";
import { SpidLevelEnum } from "io-spid-commons";
import {
  EmailString,
  FiscalCode,
  NonEmptyString
} from "italia-ts-commons/lib/strings";

import mockReq from "../../__mocks__/mockRequest";
import mockRes from "../../__mocks__/mockResponse";
import { UserRoleEnum } from "../../generated/UserRole";
import SessionStorage from "../../services/sessionStorage";
import TokenService from "../../services/tokenService";
import { SessionToken } from "../../types/token";
import { LoggedUser, validateSpidUser } from "../../types/user";
import { getRequiredEnvVar } from "../../utils/environment";
import AuthenticationController from "../authenticationController";

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.example" });

const aTimestamp = 1518010929530;
const tokenDurationSecs = 60;
const cookieDomain = getRequiredEnvVar("COOKIE_DOMAIN");

const aValidFiscalCode = "GRBGPP87L04L741X" as FiscalCode;
const aValidEmailAddress = "garibaldi@example.com" as EmailString;
const aValidName = "Giuseppe Maria";
const aValidSpidLevel = SpidLevelEnum["https://www.spid.gov.it/SpidL2"];

const mockSessionToken = "c77de47586c841adbd1a1caeb90dce25dcecebed620488a4f932a6280b10ee99a77b6c494a8a6e6884ccbeb6d3fe736b" as SessionToken;

// mock for a valid logged user
const mockedLoggedUser: LoggedUser = {
  createdAt: new Date(aTimestamp),
  email: aValidEmailAddress,
  familyName: "Garibaldi" as NonEmptyString,
  fiscalCode: aValidFiscalCode,
  givenName: "Giuseppe" as NonEmptyString,
  role: UserRoleEnum.ORG_DELEGATE,
  session: {
    createdAt: new Date(aTimestamp),
    deletedAt: null,
    email: aValidEmailAddress,
    expirationTime: new Date(aTimestamp + tokenDurationSecs * 1000),
    token: mockSessionToken
  }
};

// each field of validUserPayload is correctly set
const validUserPayload = {
  authnContextClassRef: aValidSpidLevel,
  email: aValidEmailAddress,
  familyName: "Garibaldi",
  fiscalNumber: aValidFiscalCode,
  getAssertionXml: () => "",
  issuer: {
    _: "xxx"
  },
  mobilePhone: "3222222222222",
  name: aValidName
};

// invalidUser lacks the required email field.
const invalidUserPayload = {
  authnContextClassRef: aValidSpidLevel,
  familyName: "Garibaldi",
  fiscalNumber: aValidFiscalCode,
  getAssertionXml: () => "",
  issuer: {
    _: "xxx"
  },
  mobilePhone: "3222222222222",
  name: aValidName
};

const anErrorResponse = {
  detail: undefined,
  status: 500,
  title: "Internal server error",
  type: undefined
};

const badRequestErrorResponse = {
  detail: expect.any(String),
  status: 400,
  title: expect.any(String),
  type: undefined
};

const mockGetNewToken = jest.fn();
jest.mock("../../services/tokenService", () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      getNewToken: mockGetNewToken
    }))
  };
});

const mockSet = jest.fn();
const mockGetBySessionToken = jest.fn();
const mockDel = jest.fn();
jest.mock("../../services/sessionStorage", () => ({
  default: jest.fn().mockImplementation(() => ({
    del: mockDel,
    getBySessionToken: mockGetBySessionToken,
    set: mockSet
  }))
}));

const tokenService = new TokenService();
const sessionStorage = new SessionStorage();

const clientSpidSuccessfulAccessRedirectionUrl =
  "client_spid_successful_access_redirection_url";
const clientSpidFailingAccessRedirectionUrl =
  "client_spid_failing_access_redirection_url";

let controller: AuthenticationController;
beforeAll(async () => {
  controller = new AuthenticationController(
    sessionStorage,
    tokenService,
    tokenDurationSecs,
    clientSpidFailingAccessRedirectionUrl,
    clientSpidSuccessfulAccessRedirectionUrl
  );
});

describe("AuthenticationController#acs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("redirects to the profile url if userPayload is a valid User", async () => {
    const res = mockRes();

    mockSet.mockReturnValue(Promise.resolve(none));
    mockGetNewToken.mockReturnValueOnce(mockSessionToken);

    const response = await controller.acs(validUserPayload);
    response.apply(res);

    expect(controller).toBeTruthy();
    expect(res.cookie).toHaveBeenCalledWith("sessionToken", mockSessionToken, {
      domain: cookieDomain,
      maxAge: tokenDurationSecs * 1000
    });
    expect(res.redirect).toHaveBeenCalledWith(
      301,
      clientSpidSuccessfulAccessRedirectionUrl
    );
    const validatedSpidUser = validateSpidUser(validUserPayload).value;
    expect(mockSet).toHaveBeenCalledWith(
      validatedSpidUser,
      mockSessionToken,
      tokenDurationSecs
    );
  });

  it("should fail if userPayload is invalid", async () => {
    const res = mockRes();

    const response = await controller.acs(invalidUserPayload);
    response.apply(res);

    expect(controller).toBeTruthy();
    expect(res.cookie).toHaveBeenCalledTimes(0);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(badRequestErrorResponse);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("should redirect to the client error page if db returns an error", async () => {
    const errorString = "db error";
    mockSet.mockReturnValue(Promise.resolve(some(new Error(errorString))));
    const res = mockRes();

    const response = await controller.acs(validUserPayload);
    response.apply(res);

    expect(controller).toBeTruthy();
    expect(res.cookie).toHaveBeenCalledTimes(0);
    expect(res.redirect).toHaveBeenCalledWith(
      301,
      clientSpidFailingAccessRedirectionUrl
    );
  });
});

describe("AuthenticationController#slo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("redirects to the home page", async () => {
    const res = mockRes();

    const response = await controller.slo();
    response.apply(res);

    expect(controller).toBeTruthy();
    expect(res.redirect).toHaveBeenCalledWith(301, "/");
  });
});

describe("AuthenticationController#logout", () => {
  const errorDeletionString = "Error destroying the user session";
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it("shoud return success after deleting the session token", async () => {
    const res = mockRes();
    const req = mockReq();
    req.user = mockedLoggedUser;

    mockDel.mockReturnValue(Promise.resolve(none));

    const response = await controller.logout(req);
    response.apply(res);

    expect(controller).toBeTruthy();
    expect(mockDel).toHaveBeenCalledWith(mockSessionToken);
    expect(response).toEqual({
      apply: expect.any(Function),
      kind: "IResponseNoContent",
      value: {}
    });
  });

  it("should fail if the db returns an error", async () => {
    const res = mockRes();
    const req = mockReq();
    req.user = mockedLoggedUser;
    mockDel.mockReturnValue(
      Promise.resolve(some(new Error(errorDeletionString)))
    );

    const response = await controller.logout(req);
    response.apply(res);

    expect(controller).toBeTruthy();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      ...anErrorResponse,
      detail: errorDeletionString
    });
  });
});

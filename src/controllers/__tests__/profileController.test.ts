import * as t from "io-ts";
import { ResponseSuccessJson } from "italia-ts-commons/lib/responses";
import { EmailString, FiscalCode } from "italia-ts-commons/lib/strings";
import mockReq from "../../__mocks__/request";
import ProfileService from "../../services/profileService";
import { UserProfile } from "../../types/profile";
import { SessionToken } from "../../types/token";
import { LoggedUser, UserRoleEnum } from "../../types/user";
import ProfileController from "../profileController";

const aTimestamp = 1518010929530;
const tokenDurationSecs = 60;

const aValidFiscalCode = "GRBGPP87L04L741X" as FiscalCode;
const aValidEmailAddress = "garibaldi@example.com" as EmailString;
const aValidName = "Giuseppe Maria";
const aValidSurname = "Garibaldi";

const mockSessionToken = "c77de47586c841adbd1a1caeb90dce25dcecebed620488a4f932a6280b10ee99a77b6c494a8a6e6884ccbeb6d3fe736b" as SessionToken;

// mock for a valid logged user
const mockedLoggedUser: LoggedUser = {
  createdAt: new Date(1518010929530),
  email: aValidEmailAddress,
  familyName: aValidSurname,
  firstName: aValidName,
  fiscalCode: aValidFiscalCode,
  role: UserRoleEnum.ORG_DELEGATE,
  session: {
    createdAt: new Date(aTimestamp),
    deletedAt: null,
    email: aValidEmailAddress,
    expirationTime: new Date(aTimestamp + tokenDurationSecs * 1000),
    token: mockSessionToken
  }
};

// mock for an ivalid logged user
const mockedInvalidLoggedUser = {};

const mockGetProfile = jest.fn();
const mockUpdateProfile = jest.fn();
jest.mock("../../services/profileService", () => ({
  default: jest.fn().mockImplementation(() => ({
    getProfile: mockGetProfile,
    updateProfile: mockUpdateProfile
  }))
}));

const controller = new ProfileController(new ProfileService());

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetAllMocks();
});

describe("ProfileController", () => {
  describe("#getProfile()", () => {
    it("should return a successful response with the user profile if the request is valid", async () => {
      const newWorkEmail = "new-work@email.net" as EmailString;
      const mockedUserProfile = t.exact(UserProfile).decode(mockedLoggedUser)
        .value;
      mockGetProfile.mockReturnValue(
        Promise.resolve(ResponseSuccessJson(mockedUserProfile))
      );

      const req = mockReq();
      req.user = mockedLoggedUser;
      req.body = { workEmail: newWorkEmail };

      const response = await controller.getProfile(req);

      expect(mockGetProfile).toHaveBeenCalledWith(mockedLoggedUser);
      expect(response).toEqual({
        apply: expect.any(Function),
        kind: "IResponseSuccessJson",
        value: mockedUserProfile
      });
    });
  });
  describe("#updateProfile()", () => {
    it("should return a successful response with the user profile if the request is valid", async () => {
      const newWorkEmail = "new-work@email.net" as EmailString;
      const mockedUpdatedProfile = {
        email: mockedLoggedUser.email,
        familyName: mockedLoggedUser.familyName,
        firstName: mockedLoggedUser.firstName,
        fiscalCode: mockedLoggedUser.fiscalCode,
        role: mockedLoggedUser.role,
        workEmail: newWorkEmail
      };
      mockUpdateProfile.mockReturnValue(
        Promise.resolve(ResponseSuccessJson(mockedUpdatedProfile))
      );

      const req = mockReq();
      req.user = mockedLoggedUser;
      req.body = { workEmail: newWorkEmail };

      const response = await controller.editProfile(req);

      expect(mockUpdateProfile).toHaveBeenCalledWith(
        mockedLoggedUser,
        newWorkEmail
      );
      expect(response).toEqual({
        apply: expect.any(Function),
        kind: "IResponseSuccessJson",
        value: mockedUpdatedProfile
      });
    });

    it("should return a validation error response if the request is invalid", async () => {
      const invalidWorkEmail = "invalid-email" as EmailString;

      const req = mockReq();
      req.user = mockedLoggedUser;
      req.body = { workEmail: invalidWorkEmail };

      const response = await controller.editProfile(req);

      expect(mockUpdateProfile).not.toHaveBeenCalled();
      expect(response).toHaveProperty("apply", expect.any(Function));
      expect(response).toHaveProperty("kind", "IResponseErrorValidation");
      expect(response).toHaveProperty("detail");
    });
  });
});

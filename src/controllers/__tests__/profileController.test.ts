import { left, right } from "fp-ts/lib/Either";
import { none, some } from "fp-ts/lib/Option";
import * as t from "io-ts";
import {
  ResponseErrorInternal,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import {
  EmailString,
  FiscalCode,
  NonEmptyString
} from "italia-ts-commons/lib/strings";
import mockReq from "../../__mocks__/mockRequest";
import { UserProfile } from "../../generated/UserProfile";
import { UserRoleEnum } from "../../generated/UserRole";
import EmailService from "../../services/emailService";
import ProfileService from "../../services/profileService";
import { SessionToken } from "../../types/token";
import { LoggedUser } from "../../types/user";
import ProfileController from "../profileController";

const aTimestamp = 1518010929530;
const tokenDurationSecs = 60;

const aValidFiscalCode = "GRBGPP87L04L741X" as FiscalCode;
const aValidEmailAddress = "garibaldi@example.com" as EmailString;
const aValidName = "Giuseppe Maria" as NonEmptyString;
const aValidSurname = "Garibaldi" as NonEmptyString;
const anotherValidEmailAddress = "new-work@email.net" as EmailString;

const mockSessionToken = "c77de47586c841adbd1a1caeb90dce25dcecebed620488a4f932a6280b10ee99a77b6c494a8a6e6884ccbeb6d3fe736b" as SessionToken;

// mock for a valid logged user
const mockedLoggedUser: LoggedUser = {
  createdAt: new Date(1518010929530),
  email: aValidEmailAddress,
  familyName: aValidSurname,
  fiscalCode: aValidFiscalCode,
  givenName: aValidName,
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
const mockSendEmail = jest.fn();
jest.mock("../../services/emailService", () => ({
  default: jest.fn().mockImplementation(() => ({
    send: mockSendEmail
  }))
}));

const profileService = new ProfileService();
const emailService = new EmailService(
  {
    auth: {
      pass: "password",
      user: "user"
    },
    host: "smtp.host",
    port: 1111,
    secure: false
  },
  {
    from: "sender@email.com"
  }
);

async function getProfileController(): Promise<ProfileController> {
  return new ProfileController(profileService, emailService);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetAllMocks();
});

describe("ProfileController", () => {
  describe("#getProfile()", () => {
    it("should return a successful response with the user profile if the request is valid", async () => {
      const mockedUserProfile = t.exact(UserProfile).decode({
        ...mockedLoggedUser,
        family_name: mockedLoggedUser.familyName,
        fiscal_code: mockedLoggedUser.fiscalCode,
        given_name: mockedLoggedUser.givenName
      }).value;
      mockGetProfile.mockReturnValue(
        Promise.resolve(ResponseSuccessJson(mockedUserProfile))
      );

      const req = mockReq();
      req.user = mockedLoggedUser;

      const controller = await getProfileController();
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
      const newWorkEmail = anotherValidEmailAddress as EmailString;
      const mockedUpdatedProfile = {
        email: mockedLoggedUser.email,
        family_name: mockedLoggedUser.familyName,
        fiscal_code: mockedLoggedUser.fiscalCode,
        given_name: mockedLoggedUser.givenName,
        role: mockedLoggedUser.role,
        work_email: newWorkEmail
      };
      mockUpdateProfile.mockReturnValue(
        Promise.resolve(some(ResponseSuccessJson(mockedUpdatedProfile)))
      );
      mockSendEmail.mockReturnValue(Promise.resolve(none));

      const req = mockReq();
      req.user = mockedLoggedUser;
      req.body = { work_email: newWorkEmail };

      const controller = await getProfileController();
      const response = await controller.editProfile(req);

      expect(mockUpdateProfile).toHaveBeenCalledWith(
        mockedLoggedUser,
        newWorkEmail
      );
      expect(mockSendEmail).toHaveBeenCalled();
      expect(response).toEqual({
        apply: expect.any(Function),
        kind: "IResponseSuccessJson",
        value: mockedUpdatedProfile
      });
    });

    it("should send a notification email only when the work email is updated with a different address than the email address", async () => {
      const newWorkEmail = anotherValidEmailAddress as EmailString;
      const mockedUserProfile: UserProfile = {
        email: mockedLoggedUser.email,
        family_name: mockedLoggedUser.familyName,
        fiscal_code: mockedLoggedUser.fiscalCode,
        given_name: mockedLoggedUser.givenName,
        role: mockedLoggedUser.role
      };
      mockSendEmail.mockReturnValue(Promise.resolve(none));

      const req = mockReq();

      // The work email differs from the email,
      // a notification email should be sent
      req.user = mockedLoggedUser;
      req.body = { work_email: newWorkEmail };
      mockUpdateProfile.mockReturnValue(
        Promise.resolve(
          some(
            ResponseSuccessJson({
              ...mockedUserProfile,
              work_email: newWorkEmail
            })
          )
        )
      );
      const controller = await getProfileController();
      await controller.editProfile(req);
      expect(mockSendEmail).toHaveBeenCalled();

      mockSendEmail.mockClear();

      // The work email does not differ from the email,
      // no notification email should be sent
      req.user = mockedLoggedUser;
      req.body = { work_email: req.user.email };
      mockUpdateProfile.mockReturnValue(
        Promise.resolve(
          some(
            ResponseSuccessJson({
              ...mockedUserProfile,
              work_email: req.body.work_email
            })
          )
        )
      );
      await controller.editProfile(req);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("should return a validation error response if the request is invalid", async () => {
      const invalidWorkEmail = "invalid-email" as EmailString;

      const req = mockReq();
      req.user = mockedLoggedUser;
      req.body = { work_email: invalidWorkEmail };

      const controller = await getProfileController();
      const response = await controller.editProfile(req);

      expect(mockUpdateProfile).not.toHaveBeenCalled();
      expect(response).toHaveProperty("apply", expect.any(Function));
      expect(response).toHaveProperty("kind", "IResponseErrorValidation");
      expect(response).toHaveProperty("detail");
    });

    it("should not send a notification email when the update fails", async () => {
      const newWorkEmail = anotherValidEmailAddress as EmailString;
      mockUpdateProfile.mockReturnValue(
        Promise.resolve(left(ResponseErrorInternal("error")))
      );
      mockSendEmail.mockReturnValue(Promise.resolve(none));

      const req = mockReq();
      req.user = mockedLoggedUser;
      req.body = { work_email: newWorkEmail };

      const controller = await getProfileController();
      await controller.editProfile(req);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });
});

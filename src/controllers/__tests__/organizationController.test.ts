import { isLeft, isRight, left, right } from "fp-ts/lib/Either";
import { none, some } from "fp-ts/lib/Option";
import { Task } from "fp-ts/lib/Task";
import {
  fromEither,
  left as leftTaskEither,
  right as rightTaskEither
} from "fp-ts/lib/TaskEither";
import {
  ResponseErrorInternal,
  ResponseErrorNotFound
} from "italia-ts-commons/lib/responses";
import { EmailString, NonEmptyString } from "italia-ts-commons/lib/strings";
import * as mockFs from "mock-fs";
import * as nodemailer from "nodemailer";
import * as soap from "soap";
import mockReq from "../../__mocks__/mockRequest";
import { LegalRepresentative } from "../../generated/LegalRepresentative";
import { Organization } from "../../generated/Organization";
import { OrganizationDelegate } from "../../generated/OrganizationDelegate";
import { OrganizationFiscalCode } from "../../generated/OrganizationFiscalCode";
import { OrganizationRegistrationParams } from "../../generated/OrganizationRegistrationParams";
import { OrganizationRegistrationRequest } from "../../generated/OrganizationRegistrationRequest";
import { OrganizationScopeEnum } from "../../generated/OrganizationScope";
import { RequestStatusEnum } from "../../generated/RequestStatus";
import { RequestTypeEnum } from "../../generated/RequestType";
import { UserDelegationRequest } from "../../generated/UserDelegationRequest";
import { UserRoleEnum } from "../../generated/UserRole";
import { Organization as OrganizationModel } from "../../models/Organization";
import DocumentService from "../../services/documentService";
import EmailService from "../../services/emailService";
import * as organizationService from "../../services/organizationService";
import { LoggedUser } from "../../types/user";
import { getRequiredEnvVar } from "../../utils/environment";
import { ResponseSuccessCreation } from "../../utils/responses";
import OrganizationController from "../organizationController";

const mockedLoggedDelegate: LoggedUser = {
  createdAt: new Date(1518010929530),
  email: "user@email.net",
  familyName: "Rossi",
  fiscalCode: "RSSMRA66A11B123S",
  givenName: "Mario",
  role: UserRoleEnum.ORG_DELEGATE,
  session: {
    createdAt: new Date(),
    deletedAt: null,
    email: "user@email.net",
    expirationTime: new Date(),
    token: "user-token"
  }
} as LoggedUser;

const mockCreateOnboardingRequests = jest.spyOn(
  organizationService,
  "createOnboardingRequest"
);

const mockGetOrganizationInstanceFromDelegateEmail = jest.spyOn(
  organizationService,
  "getOrganizationInstanceFromDelegateEmail"
);

const mockGetOrganizationFromUserEmail = jest.spyOn(
  organizationService,
  "getOrganizationFromUserEmail"
);

const mockGetAllOrganizations = jest.spyOn(
  organizationService,
  "getAllOrganizations"
);

const mockedOrganizationRegistrationParams = {
  ipa_code: "c_h501",
  legal_representative: {
    family_name: "Bianchi",
    fiscal_code: "RGGVGR75T63G351D",
    given_name: "Matteo",
    phone_number: "1110000000"
  },
  scope: "LOCAL",
  selected_pec_label: "1"
} as OrganizationRegistrationParams;

const onboardingOrganizationParams = {
  fiscal_code: "86000470830",
  ipa_code: "c_e043",
  legal_representative: {
    email: "indirizzo00@email.pec.it",
    family_name: "Spano'",
    fiscal_code: "BCDFGH12A21Z123D",
    given_name: "Ignazio Alfonso",
    phone_number: "5550000000",
    role: "ORG_MANAGER"
  },
  name: "Comune di Gioiosa Marea",
  pec: "indirizzo00@email.pec.it",
  scope: "NATIONAL" as OrganizationScopeEnum
};

const onboardingRequesterParams = {
  email: "user@email.net",
  family_name: "Rossi",
  fiscal_code: "RSSMRA66A11B123S",
  given_name: "Mario",
  role: UserRoleEnum.ORG_DELEGATE
} as OrganizationDelegate;

const mockedCreatedOrganizationRegistrationRequest = {
  document_id: process.hrtime().join(""),
  id: Number(process.hrtime().join("")),
  organization: onboardingOrganizationParams,
  requester: onboardingRequesterParams,
  status: RequestStatusEnum.CREATED,
  type: RequestTypeEnum.ORGANIZATION_REGISTRATION.valueOf()
} as OrganizationRegistrationRequest;

const mockedCreatedUserDelegationRequest = {
  document_id: process.hrtime().join(""),
  id: Number(process.hrtime().join("")),
  organization: onboardingOrganizationParams,
  requester: onboardingRequesterParams,
  status: RequestStatusEnum.CREATED,
  type: RequestTypeEnum.USER_DELEGATION.valueOf()
} as UserDelegationRequest;

const mockedPreDraftOrganization: Organization = {
  fiscal_code: "86000470830" as OrganizationFiscalCode,
  ipa_code: "c_e043" as NonEmptyString,
  legal_representative: {
    email: "indirizzo00@email.pec.it",
    family_name: "Spano'",
    fiscal_code: "BCDFGH12A21Z123D",
    given_name: "Ignazio Alfonso",
    phone_number: "5550000000",
    role: "ORG_MANAGER"
  } as LegalRepresentative,
  name: "Comune di Gioiosa Marea" as NonEmptyString,
  pec: "indirizzo00@email.pec.it" as EmailString,
  scope: "NATIONAL" as OrganizationScopeEnum
};
const mockedRegisteredOrganization1: Organization = {
  fiscal_code: "86000470830" as OrganizationFiscalCode,
  ipa_code: "qwerty" as NonEmptyString,
  legal_representative: {
    email: "mocked-registered-organization-1@example.com",
    family_name: "Rossi",
    fiscal_code: "BCDFGH12A21Z123D",
    given_name: "Ottavio",
    phone_number: "6660000000",
    role: "ORG_MANAGER"
  } as LegalRepresentative,
  name: "Organizzazione registrata numero 1" as NonEmptyString,
  pec: "mocked-registered-organization-1@example.com" as EmailString,
  scope: "NATIONAL" as OrganizationScopeEnum
};
const mockedRegisteredOrganization2: Organization = {
  fiscal_code: "86000470345" as OrganizationFiscalCode,
  ipa_code: "asd" as NonEmptyString,
  legal_representative: {
    email: "mocked-registered-organization-2@example.com",
    family_name: "Rossi",
    fiscal_code: "ZZZFGH12A21Z123D",
    given_name: "Egidio",
    phone_number: "6660000000",
    role: "ORG_MANAGER"
  } as LegalRepresentative,
  name: "Organizzazione registrata numero 2" as NonEmptyString,
  pec: "mocked-registered-organization-2@example.com" as EmailString,
  scope: "NATIONAL" as OrganizationScopeEnum
};
const mockedDelegate1 = {
  email: "delegate-1@example.com",
  family_name: "Rossi",
  fiscal_code: "DLGNNN53S15A012S",
  given_name: "Carlo",
  role: UserRoleEnum.ORG_DELEGATE,
  work_email: "work1@example.com"
} as OrganizationDelegate;
const mockedDelegate2 = {
  email: "delegate2@example.com",
  family_name: "Rossi",
  fiscal_code: "FSCNNN53S15A012S",
  given_name: "Teobaldo",
  role: UserRoleEnum.ORG_DELEGATE,
  work_email: "work2@example.com"
} as OrganizationDelegate;
const mockGenerateDocument = jest.fn();
const mockSignDocument = jest.fn();
const mockSendEmail = jest.fn();
jest.mock("../../services/documentService", () => ({
  default: jest.fn().mockImplementation(() => ({
    generateDocument: mockGenerateDocument,
    signDocument: mockSignDocument
  }))
}));
jest.mock("../../services/emailService", () => ({
  default: jest.fn().mockImplementation(() => ({
    send: mockSendEmail
  }))
}));

async function getOrganizationController(): Promise<OrganizationController> {
  const testEmailAccount = await nodemailer.createTestAccount();
  const transporterConfig = {
    auth: {
      pass: testEmailAccount.pass,
      user: testEmailAccount.user
    },
    from: "sender@email.com",
    host: testEmailAccount.smtp.host,
    port: testEmailAccount.smtp.port,
    secure: testEmailAccount.smtp.secure
  };
  return new OrganizationController(
    new DocumentService(
      await soap.createClientAsync(getRequiredEnvVar("ARSS_WSDL_URL"))
    ),
    new EmailService(transporterConfig)
  );
}

describe("OrganizationController", () => {
  describe("#registerOrganization()", () => {
    it("should return a left task with a forbidden error response if the user is not a delegate", async () => {
      const mockedLoggedUser: LoggedUser = {
        ...mockedLoggedDelegate,
        role: UserRoleEnum.DEVELOPER
      };
      const req = mockReq();
      req.user = mockedLoggedUser;
      req.body = mockedOrganizationRegistrationParams;
      const organizationController = await getOrganizationController();
      const result = await organizationController
        .registerOrganization(req)
        .run();
      expect(isLeft(result)).toBeTruthy();
      expect(result.value).toEqual({
        apply: expect.any(Function),
        detail: expect.any(String),
        kind: "IResponseErrorForbiddenNotAuthorized"
      });
    });

    it("should return a left task with a validation error response if the organization parameters are invalid", async () => {
      const req = mockReq();
      req.user = mockedLoggedDelegate;
      req.body = {
        ...mockedOrganizationRegistrationParams,
        scope: "INTERNATIONAL"
      };
      const organizationController = await getOrganizationController();
      const result = await organizationController
        .registerOrganization(req)
        .run();
      expect(isLeft(result)).toBeTruthy();
      expect(result.value).toEqual({
        apply: expect.any(Function),
        detail: expect.any(String),
        kind: "IResponseErrorValidation"
      });
    });

    it("should return a left task with a not found error response if the public administration does not exist", async () => {
      mockGetOrganizationInstanceFromDelegateEmail.mockImplementation(() =>
        fromEither(right([]))
      );
      mockCreateOnboardingRequests.mockReturnValue(
        fromEither(
          left(
            ResponseErrorNotFound(
              "Not found",
              "IPA public administration does not exist"
            )
          )
        )
      );
      const req = mockReq();
      req.user = mockedLoggedDelegate;
      req.body = mockedOrganizationRegistrationParams;
      const organizationController = await getOrganizationController();
      const result = await organizationController
        .registerOrganization(req)
        .run();
      expect(isLeft(result)).toBeTruthy();
      expect(result.value).toEqual({
        apply: expect.any(Function),
        detail: expect.any(String),
        kind: "IResponseErrorNotFound"
      });
    });

    it("should return a left task with an internal error response if the generation of documents fails", async () => {
      mockCreateOnboardingRequests.mockReturnValue(
        fromEither(
          right(ResponseSuccessCreation(mockedCreatedUserDelegationRequest))
        )
      );
      mockGenerateDocument.mockReturnValue(fromEither(left(Error())));
      const req = mockReq();
      req.user = mockedLoggedDelegate;
      req.body = mockedOrganizationRegistrationParams;
      const organizationController = await getOrganizationController();
      const result = await organizationController
        .registerOrganization(req)
        .run();
      expect(isLeft(result)).toBeTruthy();
      expect(result.value).toEqual({
        apply: expect.any(Function),
        detail: expect.any(String),
        kind: "IResponseErrorInternal"
      });
    });

    it("should return a right task with a success response if the registration process completes successfully", async () => {
      mockGetOrganizationInstanceFromDelegateEmail.mockImplementation(() =>
        fromEither(right([]))
      );
      mockCreateOnboardingRequests.mockReturnValue(
        fromEither(
          right(ResponseSuccessCreation(mockedCreatedUserDelegationRequest))
        )
      );
      mockGenerateDocument.mockReturnValue(fromEither(right(undefined)));
      const req = mockReq();
      req.user = mockedLoggedDelegate;
      req.body = mockedOrganizationRegistrationParams;
      const organizationController = await getOrganizationController();
      const result = await organizationController
        .registerOrganization(req)
        .run();
      expect(isRight(result)).toBeTruthy();
      expect(result.value).toEqual({
        apply: expect.any(Function),
        kind: "IResponseSuccessCreation",
        value: mockedCreatedUserDelegationRequest
      });
    });
  });

  describe("#getDocument()", () => {
    const mockedOrganizationIpaCode = "something";
    const mockedExistingFileName = "mocked-document.pdf";
    const mockedExistingDocumentContent = Buffer.from([8, 6, 7, 5, 3, 0, 9]);
    const reqParams = {
      fileName: mockedExistingFileName,
      ipaCode: "something"
    };
    it("should return a forbidden error response if the user is not a delegate", async () => {
      const mockedLoggedUser: LoggedUser = {
        ...mockedLoggedDelegate,
        role: UserRoleEnum.DEVELOPER
      };
      const req = mockReq();
      req.user = mockedLoggedUser;
      req.params = reqParams;
      const organizationController = await getOrganizationController();
      const result = await organizationController.getDocument(req);
      expect(result).toEqual({
        apply: expect.any(Function),
        detail: expect.any(String),
        kind: "IResponseErrorForbiddenNotAuthorized"
      });
    });

    it("should return a not found error if the requested document does not exist", async () => {
      const req = mockReq();
      req.user = mockedLoggedDelegate;
      req.params = {
        ...reqParams,
        fileName: "not-existing-file"
      };
      const organizationController = await getOrganizationController();
      const result = await organizationController.getDocument(req);
      expect(result).toEqual({
        apply: expect.any(Function),
        detail: expect.any(String),
        kind: "IResponseErrorNotFound"
      });
    });

    describe("when the user has permission and the requested document exists", () => {
      beforeEach(() => {
        const mockedExistingDocumentPath = `documents/${mockedOrganizationIpaCode}/${mockedExistingFileName}`;
        const mockedFsConfig = {
          [mockedExistingDocumentPath]: mockedExistingDocumentContent
        };
        mockFs(mockedFsConfig);
      });
      afterEach(() => {
        mockFs.restore();
      });

      it("should return the download of the required file", async () => {
        const req = mockReq();
        req.user = mockedLoggedDelegate;
        req.params = reqParams;
        const organizationController = await getOrganizationController();
        const result = await organizationController.getDocument(req);
        expect(result).toHaveProperty("kind", "IResponseDownload");
      });
    });
  });
});

describe.skip("OrganizationController#sendDocuments()", () => {
  it("should return a forbidden error response if the user is not a delegate", async () => {
    const mockedLoggedUser: LoggedUser = {
      ...mockedLoggedDelegate,
      role: UserRoleEnum.DEVELOPER
    };
    const req = mockReq();
    req.user = mockedLoggedUser;
    req.params = { ipaCode: mockedPreDraftOrganization.ipa_code };
    const organizationController = await getOrganizationController();
    const result = await organizationController.sendDocuments(req);
    expect(result).toEqual({
      apply: expect.any(Function),
      detail: expect.any(String),
      kind: "IResponseErrorForbiddenNotAuthorized"
    });
  });

  it("should return an internal error if the reading of the organization from the db fails", async () => {
    mockGetOrganizationInstanceFromDelegateEmail.mockImplementation(() =>
      fromEither(left(new Error("an error occurred")))
    );
    const req = mockReq();
    req.user = mockedLoggedDelegate;
    req.params = { ipaCode: mockedPreDraftOrganization.ipa_code };
    const organizationController = await getOrganizationController();
    const result = await organizationController.sendDocuments(req);
    expect(result).toEqual({
      apply: expect.any(Function),
      detail: expect.any(String),
      kind: "IResponseErrorInternal"
    });
  });

  it("should return a not found error response if no organization is found for the user", async () => {
    mockGetOrganizationInstanceFromDelegateEmail.mockImplementation(() =>
      fromEither(right([]))
    );
    const req = mockReq();
    req.user = mockedLoggedDelegate;
    req.params = { ipaCode: mockedPreDraftOrganization.ipa_code };
    const organizationController = await getOrganizationController();
    const result = await organizationController.sendDocuments(req);
    expect(result).toEqual({
      apply: expect.any(Function),
      detail: expect.any(String),
      kind: "IResponseErrorNotFound"
    });
  });

  describe("when the organization is found", () => {
    const mockedOrganizationParams = {
      fiscalCode: "86000470830",
      ipaCode: "c_e043",
      legalRepresentative: {
        email: "fake.address@email.pec.it",
        familyName: "Spano'",
        fiscalCode: "BCDFGH12A21Z123D",
        givenName: "Ignazio Alfonso",
        phoneNumber: "5550000000",
        role: "ORG_MANAGER"
      },
      name: "Comune di Gioiosa Marea",
      pec: "fake.address@email.pec.it",
      scope: "NATIONAL"
    };
    const mockedOrganizationModel = mockedOrganizationParams as OrganizationModel;
    const contractContent = "contract-content";
    const mandateContent = "mandate-content";

    function getSignedVersionBase64(
      unsignedContentBase64String: string
    ): string {
      const decodedString = Buffer.from(unsignedContentBase64String, "base64");
      return Buffer.from(`signed-${decodedString}`).toString("base64");
    }

    beforeEach(() => {
      const mockedContractPath = `documents/${mockedOrganizationModel.ipaCode}/contract.pdf`;
      const mockedMandatePath = `documents/${
        mockedOrganizationModel.ipaCode
      }/mandate-${mockedLoggedDelegate.fiscalCode.toLocaleLowerCase()}.pdf`;
      const mockedFsConfig = {
        [mockedContractPath]: Buffer.from(contractContent),
        [mockedMandatePath]: Buffer.from(mandateContent)
      };
      mockFs(mockedFsConfig);
    });
    afterEach(() => {
      mockFs.restore();
      mockSendEmail.mockReset();
    });

    it("should return a conflict error response if the organization is registered", async () => {
      mockGetOrganizationInstanceFromDelegateEmail.mockImplementation(() =>
        fromEither(
          right(
            [{
              ...mockedOrganizationParams
            } as OrganizationModel]
          )
        )
      );
      const req = mockReq();
      req.user = mockedLoggedDelegate;
      req.params = { ipaCode: mockedPreDraftOrganization.ipa_code };
      const organizationController = await getOrganizationController();
      const result = await organizationController.sendDocuments(req);
      expect(result).toEqual({
        apply: expect.any(Function),
        detail: expect.any(String),
        kind: "IResponseErrorConflict"
      });
    });

    it("should return an internal error response if the registration status cannot be updated", async () => {
      mockSignDocument.mockImplementation(contentBase64 => {
        return Promise.resolve(right(getSignedVersionBase64(contentBase64)));
      });
      mockGetOrganizationInstanceFromDelegateEmail.mockImplementation(() =>
        fromEither(
          right(
            [{
              ...mockedOrganizationParams,
              update: (params: { registrationStatus: string }) =>
                Promise.reject(new Error("organization update failed"))
            } as OrganizationModel]
          )
        )
      );
      const req = mockReq();
      req.user = mockedLoggedDelegate;
      req.params = { ipaCode: mockedPreDraftOrganization.ipa_code };
      const organizationController = await getOrganizationController();
      const result = await organizationController.sendDocuments(req);
      expect(result).toEqual({
        apply: expect.any(Function),
        detail: expect.any(String),
        kind: "IResponseErrorInternal"
      });
    });

    it("should send an email with signed attachments and return a no content response", async () => {
      mockGetOrganizationInstanceFromDelegateEmail.mockImplementation(() =>
        fromEither(
          right(
            [{
              ...mockedOrganizationParams,
              update: (params: { registrationStatus: string }) =>
                Promise.resolve(mockedOrganizationModel)
            } as OrganizationModel]
          )
        )
      );
      mockSignDocument.mockImplementation(contentBase64 => {
        return Promise.resolve(right(getSignedVersionBase64(contentBase64)));
      });
      mockSendEmail.mockReturnValue(Promise.resolve(none));
      const req = mockReq();
      req.user = mockedLoggedDelegate;
      req.params = { ipaCode: mockedPreDraftOrganization.ipa_code };
      const organizationController = await getOrganizationController();
      const result = await organizationController.sendDocuments(req);
      expect(result).toEqual({
        apply: expect.any(Function),
        kind: "IResponseNoContent",
        value: {}
      });
      expect(mockSendEmail).toHaveBeenCalledWith({
        attachments: [
          {
            filename: expect.any(String),
            path: expect.any(String)
          },
          {
            filename: expect.any(String),
            path: expect.any(String)
          }
        ],
        html: expect.any(String),
        subject: expect.any(String),
        text: expect.any(String),
        to: mockedOrganizationModel.pec
      });
    });

    it("should return an internal server error response if the documents signing fails", async () => {
      mockGetOrganizationInstanceFromDelegateEmail.mockImplementation(() =>
        fromEither(right([mockedOrganizationModel]))
      );
      mockSignDocument.mockImplementation(() =>
        Promise.resolve(left(new Error("document signing failed")))
      );
      mockSendEmail.mockReturnValue(Promise.resolve(none));
      const req = mockReq();
      req.user = mockedLoggedDelegate;
      req.params = { ipaCode: mockedPreDraftOrganization.ipa_code };
      const organizationController = await getOrganizationController();
      const result = await organizationController.sendDocuments(req);
      expect(result).toEqual({
        apply: expect.any(Function),
        detail: expect.any(String),
        kind: "IResponseErrorInternal"
      });
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });
});

describe("OrganizationController#getOrganizations()", () => {
  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
  });
  it("should return a forbidden error response if the user is a developer", async () => {
    const mockedLoggedUser: LoggedUser = {
      ...mockedLoggedDelegate,
      role: UserRoleEnum.DEVELOPER
    };
    const req = mockReq();
    req.user = mockedLoggedUser;
    const organizationController = await getOrganizationController();
    const result = await organizationController.getOrganizations(req);
    expect(result).toEqual({
      apply: expect.any(Function),
      detail: expect.any(String),
      kind: "IResponseErrorForbiddenNotAuthorized"
    });
  });

  it("should return a list with all the registered organizations if the user is an admin", async () => {
    const registeredOrganizations: ReadonlyArray<Organization> = [
      mockedRegisteredOrganization1,
      mockedRegisteredOrganization2
    ];
    mockGetAllOrganizations.mockImplementation(() => {
      return Promise.resolve(right(registeredOrganizations));
    });
    const mockedLoggedUser: LoggedUser = {
      ...mockedLoggedDelegate,
      role: UserRoleEnum.ADMIN
    };
    const req = mockReq();
    req.user = mockedLoggedUser;
    const organizationController = await getOrganizationController();
    const result = await organizationController.getOrganizations(req);
    expect(mockGetAllOrganizations).toHaveBeenCalled();
    expect(mockGetOrganizationFromUserEmail).not.toHaveBeenCalled();
    expect(result).toEqual({
      apply: expect.any(Function),
      kind: "IResponseSuccessJson",
      value: { items: registeredOrganizations }
    });
  });

  it("should return a list with the single organizations related to the delegate", async () => {
    const delegateEmail = mockedDelegate1.email;
    const registeredOrganization: Organization = {
      ...mockedRegisteredOrganization1,
      users: [mockedDelegate1, mockedDelegate2]
    };
    mockGetOrganizationFromUserEmail.mockImplementation(() => {
      return Promise.resolve(right(some(registeredOrganization)));
    });
    const organizationController = await getOrganizationController();

    const loggedDelegate: LoggedUser = {
      ...mockedLoggedDelegate,
      email: delegateEmail,
      role: UserRoleEnum.ORG_DELEGATE
    };
    const reqFromDelegate = mockReq();
    reqFromDelegate.user = loggedDelegate;
    const resultForDelegate = await organizationController.getOrganizations(
      reqFromDelegate
    );
    expect(mockGetAllOrganizations).not.toHaveBeenCalled();
    expect(mockGetOrganizationFromUserEmail).toHaveBeenCalledWith(
      delegateEmail
    );
    expect(resultForDelegate).toEqual({
      apply: expect.any(Function),
      kind: "IResponseSuccessJson",
      value: { items: [registeredOrganization] }
    });
  });

  it("should return a list with the single organizations related to the legal representative", async () => {
    const legalRepresentativeEmail = mockedRegisteredOrganization1.legal_representative!
      .email;
    const registeredOrganization: Organization = {
      ...mockedRegisteredOrganization1,
      users: [mockedDelegate1, mockedDelegate2]
    };
    mockGetOrganizationFromUserEmail.mockImplementation(() => {
      return Promise.resolve(right(some(registeredOrganization)));
    });
    const organizationController = await getOrganizationController();

    const loggedLegalRepresentative: LoggedUser = {
      ...mockedLoggedDelegate,
      email: legalRepresentativeEmail,
      role: UserRoleEnum.ORG_MANAGER
    };
    const reqFromLegalRepresentative = mockReq();
    reqFromLegalRepresentative.user = loggedLegalRepresentative;
    const resultForLegalRepresentative = await organizationController.getOrganizations(
      reqFromLegalRepresentative
    );
    expect(mockGetAllOrganizations).not.toHaveBeenCalled();
    expect(mockGetOrganizationFromUserEmail).toHaveBeenCalledWith(
      legalRepresentativeEmail
    );
    expect(resultForLegalRepresentative).toEqual({
      apply: expect.any(Function),
      kind: "IResponseSuccessJson",
      value: { items: [registeredOrganization] }
    });
  });
});

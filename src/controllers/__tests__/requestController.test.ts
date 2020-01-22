import { isLeft, isRight, left, right } from "fp-ts/lib/Either";
import { none, some } from "fp-ts/lib/Option";
import { fromEither } from "fp-ts/lib/TaskEither";
import { ResponseErrorNotFound } from "italia-ts-commons/lib/responses";
import { EmailString, NonEmptyString } from "italia-ts-commons/lib/strings";
import * as mockFs from "mock-fs";
import * as nock from "nock";
import {
  NonNullFindOptions,
  Promise as SequelizePromise,
  WhereAttributeHash
} from "sequelize";
import * as soap from "soap";
import { WSDL, XSD } from "../../__mocks__/arss";
import mockReq from "../../__mocks__/mockRequest";
import { LegalRepresentative } from "../../generated/LegalRepresentative";
import { Organization } from "../../generated/Organization";
import { OrganizationDelegate } from "../../generated/OrganizationDelegate";
import { OrganizationFiscalCode } from "../../generated/OrganizationFiscalCode";
import { OrganizationRegistrationParams } from "../../generated/OrganizationRegistrationParams";
import { OrganizationRegistrationRequest } from "../../generated/OrganizationRegistrationRequest";
import { OrganizationScopeEnum } from "../../generated/OrganizationScope";
import { RequestActionEnum } from "../../generated/RequestAction";
import { RequestStatusEnum } from "../../generated/RequestStatus";
import { RequestTypeEnum } from "../../generated/RequestType";
import { UserDelegationRequest } from "../../generated/UserDelegationRequest";
import { UserRoleEnum } from "../../generated/UserRole";
import DocumentService from "../../services/documentService";
import EmailService from "../../services/emailService";
import * as organizationService from "../../services/organizationService";
import { LoggedUser } from "../../types/user";
import { ResponseSuccessCreation } from "../../utils/responses";
import RequestController from "../requestController";

import {
  createAssociations as createRequestModelAssociations,
  init as initRequestModel,
  Request as RequestModel
} from "../../models/Request";
import { init as initUserModel, User as UserModel } from "../../models/User";

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

const requestCommonProperties = {
  legalRepresentativeFamilyName: "Spano'",
  legalRepresentativeFiscalCode: "BCDFGH12A21Z123D",
  legalRepresentativeGivenName: "Ignazio Alfonso",
  legalRepresentativePhoneNumber: "5550000000",
  organizationFiscalCode: "86000470830",
  organizationIpaCode: "c_e043",
  organizationName: "Comune di Gioiosa Marea",
  organizationPec: "indirizzo00@email.pec.it",
  organizationScope: "NATIONAL",
  status: RequestStatusEnum.CREATED,
  type: RequestTypeEnum.ORGANIZATION_REGISTRATION
};

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

const mockedRequestModelScope = jest.spyOn(RequestModel, "scope");
mockedRequestModelScope.mockImplementation(() => RequestModel);
const mockedRequestModelFindOne = jest.spyOn(RequestModel, "findOne");
const mockedRequestModelInstanceUpdate = jest.spyOn(
  RequestModel.prototype,
  "update"
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
    phone_number: "5550000000"
  },
  name: "Comune di Gioiosa Marea",
  pec: "indirizzo00@email.pec.it",
  scope: "NATIONAL" as OrganizationScopeEnum
};

const onboardingRequesterParams = {
  email: "user@email.net",
  family_name: "Rossi",
  fiscal_code: "RSSMRA66A11B123S",
  given_name: "Mario"
} as OrganizationDelegate;

const mockedCreatedOrganizationRegistrationRequest = {
  id: Number(process.hrtime().join("")),
  organization: onboardingOrganizationParams,
  requester: onboardingRequesterParams,
  status: RequestStatusEnum.CREATED,
  type: RequestTypeEnum.ORGANIZATION_REGISTRATION.valueOf()
} as OrganizationRegistrationRequest;

const mockedCreatedUserDelegationRequest = {
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
    phone_number: "5550000000"
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
    phone_number: "6660000000"
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
    phone_number: "6660000000"
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
  work_email: "work1@example.com"
} as OrganizationDelegate;
const mockedDelegate2 = {
  email: "delegate2@example.com",
  family_name: "Rossi",
  fiscal_code: "FSCNNN53S15A012S",
  given_name: "Teobaldo",
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

const MOCK_ARSS_WSDL_HOST = "https://arss.demo.firma-automatica.it";
const MOCK_ARSS_WSDL_PATH = "/ArubaSignService/ArubaSignService?wsdl";
const MOCK_ARSS_XSD_PATH = "/ArubaSignService/ArubaSignService?xsd=1";

nock(MOCK_ARSS_WSDL_HOST)
  .get(MOCK_ARSS_WSDL_PATH)
  .reply(200, WSDL)
  .persist(true)
  .get(MOCK_ARSS_XSD_PATH)
  .reply(200, XSD)
  .persist(true);

async function getRequestController(): Promise<RequestController> {
  const transporterConfig = {
    auth: {
      pass: "password",
      user: "user"
    },
    from: "sender@example.com",
    host: "host",
    port: 12345,
    secure: true
  };
  return new RequestController(
    new DocumentService(
      await soap.createClientAsync(MOCK_ARSS_WSDL_HOST + MOCK_ARSS_WSDL_PATH)
    ),
    new EmailService(transporterConfig, {})
  );
}

describe("RequestController", () => {
  describe("#registerOrganization()", () => {
    it("should return a forbidden error response if the user is not a delegate", async () => {
      const mockedLoggedUser: LoggedUser = {
        ...mockedLoggedDelegate,
        role: UserRoleEnum.DEVELOPER
      };
      const req = mockReq();
      req.user = mockedLoggedUser;
      req.body = mockedOrganizationRegistrationParams;
      const requestController = await getRequestController();
      const result = await requestController.registerOrganization(req).run();
      expect(isLeft(result)).toBeTruthy();
      expect(result.value).toEqual({
        apply: expect.any(Function),
        detail: expect.any(String),
        kind: "IResponseErrorForbiddenNotAuthorized"
      });
    });

    it("should return a validation error response if the organization parameters are invalid", async () => {
      const req = mockReq();
      req.user = mockedLoggedDelegate;
      req.body = {
        ...mockedOrganizationRegistrationParams,
        scope: "INTERNATIONAL"
      };
      const requestController = await getRequestController();
      const result = await requestController.registerOrganization(req).run();
      expect(isLeft(result)).toBeTruthy();
      expect(result.value).toEqual({
        apply: expect.any(Function),
        detail: expect.any(String),
        kind: "IResponseErrorValidation"
      });
    });

    it("should return a not found error response if the public administration does not exist", async () => {
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
      const requestController = await getRequestController();
      const result = await requestController.registerOrganization(req).run();
      expect(isLeft(result)).toBeTruthy();
      expect(result.value).toEqual({
        apply: expect.any(Function),
        detail: expect.any(String),
        kind: "IResponseErrorNotFound"
      });
    });

    it("should return an internal error response if the generation of documents fails", async () => {
      mockCreateOnboardingRequests.mockReturnValue(
        fromEither(
          right(ResponseSuccessCreation(mockedCreatedUserDelegationRequest))
        )
      );
      mockGenerateDocument.mockReturnValue(fromEither(left(Error())));
      const req = mockReq();
      req.user = mockedLoggedDelegate;
      req.body = mockedOrganizationRegistrationParams;
      const requestController = await getRequestController();
      const result = await requestController.registerOrganization(req).run();
      expect(isLeft(result)).toBeTruthy();
      expect(result.value).toEqual({
        apply: expect.any(Function),
        detail: expect.any(String),
        kind: "IResponseErrorInternal"
      });
    });

    it("should return a success response if the registration process completes successfully", async () => {
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
      const requestController = await getRequestController();
      const result = await requestController.registerOrganization(req).run();
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
      const requestController = await getRequestController();
      const result = await requestController.getDocument(req);
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
      const requestController = await getRequestController();
      const result = await requestController.getDocument(req);
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
        const requestController = await getRequestController();
        const result = await requestController.getDocument(req);
        expect(result).toHaveProperty("kind", "IResponseDownload");
      });
    });
  });
});

describe("RequestController#handleAction()", () => {
  mockedRequestModelInstanceUpdate.mockResolvedValue(
    (undefined as unknown) as RequestModel
  );
  initUserModel();
  initRequestModel();
  createRequestModelAssociations();
  const loggedDelegateModel = UserModel.build(mockedLoggedDelegate);
  const otherUserModel = UserModel.build({
    ...mockedLoggedDelegate,
    email: "other-user@example.com"
  });
  const organizationRegistrationRequestModel = RequestModel.build({
    id: Number(process.hrtime().join("")),
    ...requestCommonProperties,
    type: RequestTypeEnum.ORGANIZATION_REGISTRATION
  });
  organizationRegistrationRequestModel.setDataValue(
    "requester",
    loggedDelegateModel
  );
  const userDelegationRequestModel = RequestModel.build({
    id: Number(process.hrtime().join("")),
    ...requestCommonProperties,
    type: RequestTypeEnum.USER_DELEGATION
  });
  userDelegationRequestModel.setDataValue("requester", loggedDelegateModel);
  const requestModelFromOtherUser = RequestModel.build({
    id: Number(process.hrtime().join("")),
    ...requestCommonProperties
  });
  requestModelFromOtherUser.setDataValue("requester", otherUserModel);
  const requestModelForAnotherAdministration = RequestModel.build({
    id: Number(process.hrtime().join("")),
    ...requestCommonProperties,
    organizationPec: "other-administration@example.com"
  });
  requestModelForAnotherAdministration.setDataValue(
    "requester",
    loggedDelegateModel
  );
  const requestModelAlreadySubmitted = RequestModel.build({
    id: Number(process.hrtime().join("")),
    ...requestCommonProperties,
    status: RequestStatusEnum.SUBMITTED,
    type: RequestTypeEnum.USER_DELEGATION
  });
  requestModelAlreadySubmitted.setDataValue("requester", loggedDelegateModel);
  const requestModelFailingToUpdate = RequestModel.build({
    id: Number(process.hrtime().join("")),
    ...requestCommonProperties,
    status: RequestStatusEnum.SUBMITTED,
    type: RequestTypeEnum.USER_DELEGATION
  });
  requestModelFailingToUpdate.setDataValue("requester", loggedDelegateModel);
  const requestModels: ReadonlyArray<RequestModel> = [
    organizationRegistrationRequestModel,
    userDelegationRequestModel,
    requestModelFromOtherUser,
    requestModelForAnotherAdministration,
    requestModelAlreadySubmitted,
    requestModelFailingToUpdate
  ];
  const mockFindOneImplementationDefault = (options: NonNullFindOptions) => {
    if (!options || !options.where || !options.where.hasOwnProperty("id")) {
      return fail("wrong invocation of Model.findOne() method");
    }
    return SequelizePromise.resolve(
      requestModels.find(
        request => request.id === (options.where as WhereAttributeHash).id
      ) || ((null as unknown) as RequestModel)
    );
  };
  afterEach(() => {
    mockedRequestModelInstanceUpdate.mockClear();
  });

  it("should return a forbidden error response if the user is not a delegate", async () => {
    const mockedLoggedUser: LoggedUser = {
      ...mockedLoggedDelegate,
      role: UserRoleEnum.DEVELOPER
    };
    const req = mockReq();
    req.user = mockedLoggedUser;
    req.body = {
      ids: [1, 2],
      type: RequestActionEnum.SEND_REGISTRATION_REQUEST_EMAIL_TO_ORG
    };
    const requestController = await getRequestController();
    const result = await requestController.handleAction(req).run();
    expect(isLeft(result)).toBeTruthy();
    expect(result.value).toEqual({
      apply: expect.any(Function),
      detail: expect.any(String),
      kind: "IResponseErrorForbiddenNotAuthorized"
    });
  });

  it("should return an error validation response when the request is invalid", async () => {
    const req = mockReq();
    req.user = mockedLoggedDelegate;
    req.body = {
      ids: 1,
      type: RequestActionEnum.SEND_REGISTRATION_REQUEST_EMAIL_TO_ORG
    };
    const requestController = await getRequestController();
    const result = await requestController.handleAction(req).run();
    expect(isLeft(result)).toBeTruthy();
    expect(result.value).toEqual({
      apply: expect.any(Function),
      detail: expect.any(String),
      kind: "IResponseErrorValidation"
    });
  });

  it("should return an internal error if the reading of a request from the db fails", async () => {
    mockedRequestModelFindOne.mockImplementation(() =>
      SequelizePromise.reject(new Error("db error"))
    );
    const req = mockReq();
    req.user = mockedLoggedDelegate;
    req.body = {
      ids: [1, 2],
      type: RequestActionEnum.SEND_REGISTRATION_REQUEST_EMAIL_TO_ORG
    };
    const requestController = await getRequestController();
    const result = await requestController.handleAction(req).run();
    expect(isLeft(result)).toBeTruthy();
    expect(result.value).toEqual({
      apply: expect.any(Function),
      detail: expect.any(String),
      kind: "IResponseErrorInternal"
    });
  });

  it("should return a not found error if any of the provided id refers to a not existing request", async () => {
    mockedRequestModelFindOne.mockImplementation(
      mockFindOneImplementationDefault
    );
    const req = mockReq();
    req.user = mockedLoggedDelegate;
    req.body = {
      ids: [Date.now()],
      type: RequestActionEnum.SEND_REGISTRATION_REQUEST_EMAIL_TO_ORG
    };
    const requestController = await getRequestController();
    const result = await requestController.handleAction(req).run();
    expect(isLeft(result)).toBeTruthy();
    expect(result.value).toEqual({
      apply: expect.any(Function),
      detail: expect.any(String),
      kind: "IResponseErrorNotFound"
    });
  });

  it("should return a forbidden error response if any of the provided ids refers to a request created by a different user", async () => {
    mockedRequestModelFindOne.mockImplementation(
      mockFindOneImplementationDefault
    );
    const req = mockReq();
    req.user = mockedLoggedDelegate;
    req.body = {
      ids: [requestModelFromOtherUser.id],
      type: RequestActionEnum.SEND_REGISTRATION_REQUEST_EMAIL_TO_ORG
    };
    const requestController = await getRequestController();
    const result = await requestController.handleAction(req).run();
    expect(isLeft(result)).toBeTruthy();
    expect(result.value).toEqual({
      apply: expect.any(Function),
      detail: expect.any(String),
      kind: "IResponseErrorForbiddenNotAuthorized"
    });
  });

  it("should return a conflict error response if any of the provided ids refers to request whose status is not CREATED", async () => {
    mockedRequestModelFindOne.mockImplementation(
      mockFindOneImplementationDefault
    );
    const req = mockReq();
    req.user = mockedLoggedDelegate;
    req.body = {
      ids: [
        organizationRegistrationRequestModel.id,
        requestModelAlreadySubmitted.id
      ],
      type: RequestActionEnum.SEND_REGISTRATION_REQUEST_EMAIL_TO_ORG
    };
    const requestController = await getRequestController();
    const result = await requestController.handleAction(req).run();
    expect(isLeft(result)).toBeTruthy();
    expect(result.value).toEqual({
      apply: expect.any(Function),
      detail: expect.any(String),
      kind: "IResponseErrorConflict"
    });
  });

  it("should return a conflict error response if the provided ids refer to requests to be sent to different email addresses", async () => {
    mockedRequestModelFindOne.mockImplementation(
      mockFindOneImplementationDefault
    );
    const req = mockReq();
    req.user = mockedLoggedDelegate;
    req.body = {
      ids: [
        organizationRegistrationRequestModel.id,
        requestModelForAnotherAdministration.id
      ],
      type: RequestActionEnum.SEND_REGISTRATION_REQUEST_EMAIL_TO_ORG
    };
    const requestController = await getRequestController();
    const result = await requestController.handleAction(req).run();
    expect(isLeft(result)).toBeTruthy();
    expect(result.value).toEqual({
      apply: expect.any(Function),
      detail: expect.any(String),
      kind: "IResponseErrorConflict"
    });
  });

  describe("when the request is valid and the provided id refer to valid requests", () => {
    // tslint:disable-next-line:no-let
    let validRequestsToBeSubmitted: ReadonlyArray<RequestModel>;

    function getSignedVersionBase64(
      unsignedContentBase64String: string
    ): string {
      const decodedString = Buffer.from(unsignedContentBase64String, "base64");
      return Buffer.from(`signed-${decodedString}`).toString("base64");
    }

    beforeEach(() => {
      validRequestsToBeSubmitted = [
        organizationRegistrationRequestModel,
        userDelegationRequestModel
      ];

      const mockedFsConfig = validRequestsToBeSubmitted
        .concat(requestModelFailingToUpdate)
        .reduce(
          (items, request) => ({
            ...items,
            [`documents/unsigned/${request.id}.pdf`]: Buffer.from(
              "request-content"
            )
          }),
          {}
        );
      mockFs(mockedFsConfig);
    });
    afterEach(() => {
      mockFs.restore();
      mockSendEmail.mockReset();
      requestModels.forEach(
        requestModel => (requestModel.status = RequestStatusEnum.CREATED)
      );
    });

    it("should return an internal server error response if the documents signing fails", async () => {
      mockSignDocument.mockReturnValue(
        fromEither(left(new Error("document signing failed")))
      );
      mockSendEmail.mockReturnValue(Promise.resolve(none));
      const req = mockReq();
      req.user = mockedLoggedDelegate;
      req.body = {
        ids: validRequestsToBeSubmitted.map(_ => _.id),
        type: RequestActionEnum.SEND_REGISTRATION_REQUEST_EMAIL_TO_ORG
      };
      const requestController = await getRequestController();
      const result = await requestController.handleAction(req).run();
      expect(left(result)).toBeTruthy();
      expect(result.value).toEqual({
        apply: expect.any(Function),
        detail: expect.any(String),
        kind: "IResponseErrorInternal"
      });
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(mockedRequestModelInstanceUpdate).not.toHaveBeenCalled();
    });

    it("should send an email with signed attachments and return a no content response", async () => {
      mockSignDocument.mockImplementation(contentBase64 =>
        fromEither(right(getSignedVersionBase64(contentBase64)))
      );
      mockSendEmail.mockReturnValue(Promise.resolve(none));
      const req = mockReq();
      req.user = mockedLoggedDelegate;
      req.body = {
        ids: validRequestsToBeSubmitted.map(_ => _.id),
        type: RequestActionEnum.SEND_REGISTRATION_REQUEST_EMAIL_TO_ORG
      };
      const requestController = await getRequestController();
      const result = await requestController.handleAction(req).run();
      expect(isRight(result)).toBeTruthy();
      expect(result.value).toEqual({
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
        to: validRequestsToBeSubmitted[0].organizationPec
      });
      validRequestsToBeSubmitted.forEach((_, index) =>
        expect(mockedRequestModelInstanceUpdate).toHaveBeenNthCalledWith(
          index + 1,
          {
            status: RequestStatusEnum.SUBMITTED
          }
        )
      );
    });

    it("should return an internal error response if the request status cannot be updated", async () => {
      mockSignDocument.mockImplementation(contentBase64 =>
        fromEither(right(getSignedVersionBase64(contentBase64)))
      );
      mockSendEmail.mockReturnValue(Promise.resolve(none));
      mockedRequestModelInstanceUpdate.mockRejectedValueOnce(
        "error on request update"
      );
      const req = mockReq();
      req.user = mockedLoggedDelegate;
      req.body = {
        ids: [requestModelFailingToUpdate.id],
        type: RequestActionEnum.SEND_REGISTRATION_REQUEST_EMAIL_TO_ORG
      };
      const requestController = await getRequestController();
      const result = await requestController.handleAction(req).run();
      expect(isLeft(result)).toBeTruthy();
      expect(result.value).toEqual({
        apply: expect.any(Function),
        detail: expect.any(String),
        kind: "IResponseErrorInternal"
      });
      expect(mockedRequestModelInstanceUpdate).toHaveBeenCalledWith({
        status: RequestStatusEnum.SUBMITTED
      });
    });
  });
});

describe("RequestController#getOrganizations()", () => {
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
    const requestController = await getRequestController();
    const result = await requestController.getOrganizations(req);
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
    const requestController = await getRequestController();
    const result = await requestController.getOrganizations(req);
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
    const requestController = await getRequestController();

    const loggedDelegate: LoggedUser = {
      ...mockedLoggedDelegate,
      email: delegateEmail,
      role: UserRoleEnum.ORG_DELEGATE
    };
    const reqFromDelegate = mockReq();
    reqFromDelegate.user = loggedDelegate;
    const resultForDelegate = await requestController.getOrganizations(
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
    const requestController = await getRequestController();

    const loggedLegalRepresentative: LoggedUser = {
      ...mockedLoggedDelegate,
      email: legalRepresentativeEmail,
      role: UserRoleEnum.ORG_MANAGER
    };
    const reqFromLegalRepresentative = mockReq();
    reqFromLegalRepresentative.user = loggedLegalRepresentative;
    const resultForLegalRepresentative = await requestController.getOrganizations(
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

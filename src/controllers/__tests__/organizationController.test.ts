import { left, right } from "fp-ts/lib/Either";
import { none, some } from "fp-ts/lib/Option";
import {
  ResponseErrorNotFound,
  ResponseSuccessRedirectToResource
} from "italia-ts-commons/lib/responses";
import { EmailString, NonEmptyString } from "italia-ts-commons/lib/strings";
import mockReq from "../../__mocks__/request";
import { LegalRepresentative } from "../../generated/LegalRepresentative";
import { Organization } from "../../generated/Organization";
import { OrganizationFiscalCode } from "../../generated/OrganizationFiscalCode";
import { OrganizationRegistrationParams } from "../../generated/OrganizationRegistrationParams";
import { OrganizationScopeEnum } from "../../generated/OrganizationScope";
import { UserRoleEnum } from "../../generated/UserRole";
import DocumentService from "../../services/documentService";
import * as organizationService from "../../services/organizationService";
import { LoggedUser } from "../../types/user";
import OrganizationController from "../organizationController";

// import * as mockFs from "mock-fs";

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

const mockRegisterOrganization = jest.spyOn(
  organizationService,
  "registerOrganization"
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

const mockedRegisteredOrganization: Organization = {
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
  links: [
    {
      href: "/organizations/c_e043",
      rel: "self"
    },
    {
      href: "/organizations/c_e043",
      rel: "edit"
    }
  ],
  name: "Comune di Gioiosa Marea" as NonEmptyString,
  pec: "indirizzo00@email.pec.it" as EmailString,
  scope: "NATIONAL" as OrganizationScopeEnum
};
const mockGenerateDocument = jest.fn();
jest.mock("../../services/documentService", () => ({
  default: jest.fn().mockImplementation(() => ({
    generateDocument: mockGenerateDocument
  }))
}));

function getOrganizationController(): OrganizationController {
  return new OrganizationController(new DocumentService());
}

describe("OrganizationController", () => {
  describe("#registerOrganization()", () => {
    it("should return a forbidden error respose if the user is not a delegate", async () => {
      const mockedLoggedUser: LoggedUser = {
        ...mockedLoggedDelegate,
        role: UserRoleEnum.DEVELOPER
      };
      const req = mockReq();
      req.user = mockedLoggedUser;
      req.body = mockedOrganizationRegistrationParams;
      const organizationController = getOrganizationController();
      const result = await organizationController.registerOrganization(req);
      expect(result).toEqual({
        apply: expect.any(Function),
        detail: expect.any(String),
        kind: "IResponseErrorForbiddenNotAuthorized"
      });
    });

    it("should return a validation error if the organization parameters are invalid", async () => {
      const req = mockReq();
      req.user = mockedLoggedDelegate;
      req.body = {
        ...mockedOrganizationRegistrationParams,
        scope: "INTERNATIONAL"
      };
      const organizationController = getOrganizationController();
      const result = await organizationController.registerOrganization(req);
      expect(result).toEqual({
        apply: expect.any(Function),
        detail: expect.any(String),
        kind: "IResponseErrorValidation"
      });
    });

    it("should return a not found error if the public administration does not exist", async () => {
      mockRegisterOrganization.mockReturnValue(
        Promise.resolve(
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
      const organizationController = getOrganizationController();
      const result = await organizationController.registerOrganization(req);
      expect(result).toEqual({
        apply: expect.any(Function),
        detail: expect.any(String),
        kind: "IResponseErrorNotFound"
      });
    });

    it("should return an internal server error if the generation of documents fails", async () => {
      mockRegisterOrganization.mockReturnValue(
        Promise.resolve(
          right(
            ResponseSuccessRedirectToResource(
              mockedRegisteredOrganization,
              mockedRegisteredOrganization.links[0].href,
              mockedRegisteredOrganization
            )
          )
        )
      );
      mockGenerateDocument.mockReturnValue(some(Error()));
      const req = mockReq();
      req.user = mockedLoggedDelegate;
      req.body = mockedOrganizationRegistrationParams;
      const organizationController = getOrganizationController();
      const result = await organizationController.registerOrganization(req);
      expect(result).toEqual({
        apply: expect.any(Function),
        detail: expect.any(String),
        kind: "IResponseErrorInternal"
      });
    });

    it("should return a success response if the registration process completes successfully", async () => {
      mockRegisterOrganization.mockReturnValue(
        Promise.resolve(
          right(
            ResponseSuccessRedirectToResource(
              mockedRegisteredOrganization,
              mockedRegisteredOrganization.links[0].href,
              mockedRegisteredOrganization
            )
          )
        )
      );
      mockGenerateDocument.mockReturnValue(none);
      const req = mockReq();
      req.user = mockedLoggedDelegate;
      req.body = mockedOrganizationRegistrationParams;
      const organizationController = getOrganizationController();
      const result = await organizationController.registerOrganization(req);
      expect(result).toEqual({
        apply: expect.any(Function),
        detail: mockedRegisteredOrganization.links[0].href,
        kind: "IResponseSuccessRedirectToResource",
        payload: mockedRegisteredOrganization,
        resource: mockedRegisteredOrganization
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
    it("should return a forbidden error respose if the user is not a delegate", async () => {
      const mockedLoggedUser: LoggedUser = {
        ...mockedLoggedDelegate,
        role: UserRoleEnum.DEVELOPER
      };
      const req = mockReq();
      req.user = mockedLoggedUser;
      req.params = reqParams;
      const organizationController = getOrganizationController();
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
      const organizationController = getOrganizationController();
      const result = await organizationController.getDocument(req);
      expect(result).toEqual({
        apply: expect.any(Function),
        detail: expect.any(String),
        kind: "IResponseErrorNotFound"
      });
    });

    describe("when the user has permission and the requested document exists", () => {
      beforeEach(() => {
        // const mockedExistingDocumentPath = `documents/${mockedOrganizationIpaCode}/${mockedExistingFileName}`;
        // const mockedFsConfig = {
        //   [mockedExistingDocumentPath]: mockedExistingDocumentContent
        // };
        // mockFs(mockedFsConfig);
      });
      afterEach(() => {
        // mockFs.restore();
      });

      it("should return the download of the required file", async () => {
        const req = mockReq();
        req.user = mockedLoggedDelegate;
        req.params = reqParams;
        const organizationController = getOrganizationController();
        const result = await organizationController.getDocument(req);
        expect(result).toHaveProperty("kind", "IResponseDownload");
      });
    });
  });
});

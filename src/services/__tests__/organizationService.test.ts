import { isLeft, isRight, right } from "fp-ts/lib/Either";
import { isNone, isSome, some } from "fp-ts/lib/Option";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { Sequelize } from "sequelize";
import { FiscalCode } from "../../generated/FiscalCode";
import { OrganizationRegistrationParams } from "../../generated/OrganizationRegistrationParams";
import { OrganizationScopeEnum } from "../../generated/OrganizationScope";
import { RequestStatusEnum } from "../../generated/RequestStatus";
import { RequestTypeEnum } from "../../generated/RequestType";
import { UserRoleEnum } from "../../generated/UserRole";
import {
  createOnboardingRequest,
  getAllOrganizations,
  getOrganizationFromUserEmail,
  getOrganizationInstanceFromDelegateEmail
} from "../organizationService";

jest.mock("../../database/db", () => ({
  default: new Sequelize({
    dialect: "sqlite",
    logging: false
  })
}));

import {
  init as initIpaPublicAdministration,
  IpaPublicAdministration as IpaPublicAdministrationModel
} from "../../models/IpaPublicAdministration";
import {
  createAssociations as createOrganizationAssociations,
  init as initOrganization,
  Organization as OrganizationModel
} from "../../models/Organization";
import {
  init as initOrganizationUser,
  OrganizationUser as OrganizationUserModel
} from "../../models/OrganizationUser";
import {
  createAssociations as createRequestAssociations,
  init as initRequest,
  Request as RequestModel
} from "../../models/Request";
import {
  createAssociations as createSessionAssociations,
  init as initSession,
  Session as SessionModel
} from "../../models/Session";
import {
  createAssociations as createUserAssociations,
  init as initUser,
  User as UserModel
} from "../../models/User";
import { toOrganizationObject } from "../../types/organization";
import { SessionToken } from "../../types/token";
import { LoggedUser } from "../../types/user";

const userInfo = {
  email: "delegate@email.net",
  familyName: "Bianchi",
  fiscalCode: "BNCMRA78S23G377D",
  givenName: "Mario",
  role: UserRoleEnum.ORG_DELEGATE,
  session: {
    email: "delegate@email.net",
    expirationTime: new Date(Date.now() + 3600000),
    token: "HexToKen" as SessionToken
  }
};

// Administrator user
const adminParams = {
  email: "admin@example.com",
  familyName: "Bianchi",
  fiscalCode: "DMNGPP58S05A012Z",
  givenName: "Giuseppe",
  role: UserRoleEnum.ADMIN
};

// Registered organization and associated users
const registeredOrgDelegateParams1 = {
  email: "delegate1@example.com",
  familyName: "Rossi",
  fiscalCode: "DLGNNN53S15A012S",
  givenName: "Carlo",
  role: UserRoleEnum.ORG_DELEGATE,
  workEmail: "work1@example.com"
};
const registeredOrgDelegateParams2 = {
  email: "delegate2@example.com",
  familyName: "Rossi",
  fiscalCode: "DLGTTT34S12A012G",
  givenName: "Matteo",
  phoneNumber: "020202020202",
  role: UserRoleEnum.ORG_DELEGATE,
  workEmail: "work2@example.com"
};
const registeredOrgLegalRepresentativeParams = {
  email: "registered-org-legal-representative@example.com",
  familyName: "Rossi",
  fiscalCode: "LGLRPR67A23A012V",
  givenName: "Mario",
  phoneNumber: "0606060606",
  role: UserRoleEnum.ORG_MANAGER
};
const mockRegisteredOrganizationParams = {
  fiscalCode: "00000000001",
  ipaCode: "org1",
  legalRepresentative: registeredOrgLegalRepresentativeParams,
  name: "Organizzazione 1",
  pec: "org1@example.com",
  scope: OrganizationScopeEnum.LOCAL
};

// PRE_DRAFT organization and associated users
const preDraftOrgDelegateParams = {
  email: "delegate-of-pre-draft-org@example.com",
  familyName: "Rossi",
  fiscalCode: "DLGLGU34S12A012F",
  givenName: "Luigi",
  phoneNumber: "0000000000",
  role: UserRoleEnum.ORG_DELEGATE,
  workEmail: "work2@example.com"
};
const preDraftOrgLegalRepresentativeParams = {
  email: "pre-draft-org-legal-representative@example.com",
  familyName: "Rossi",
  fiscalCode: "LGLRPR67A23A012V",
  givenName: "Mario",
  phoneNumber: "0606060606",
  role: UserRoleEnum.ORG_MANAGER
};
const mockPreDraftOrganizationParams = {
  fiscalCode: "00000000002",
  ipaCode: "org2",
  legalRepresentative: preDraftOrgLegalRepresentativeParams,
  name: "Organizzazione 2",
  pec: "org2@example.com",
  scope: OrganizationScopeEnum.LOCAL
};
// Delegate with no association associated
const noOrgDelegateParams = {
  email: "delegate-with-no-org@example.com",
  familyName: "Rossi",
  fiscalCode: "DLGCLR66L22A012D",
  givenName: "Carlo",
  phoneNumber: "9999999999",
  role: UserRoleEnum.ORG_DELEGATE,
  workEmail: "no-work@example.com"
};

const validPublicAdministrationAttributes = {
  Cf: "86000470830",
  cf_validato: "S",
  cod_amm: "generic_code",
  cogn_resp: "Rossi",
  des_amm: "Name of the Public Administration",
  mail1: "pec1@email.net",
  mail2: "pec2@email.net",
  mail3: "simple@email.net",
  mail4: "null",
  mail5: "null",
  nome_resp: "Mario",
  tipo_mail1: "pec",
  tipo_mail2: "pec",
  tipo_mail3: "altro",
  tipo_mail4: "null",
  tipo_mail5: "null",
  titolo_resp: "presidente"
};

// tslint:disable-next-line:no-let
let user: LoggedUser;
// tslint:disable-next-line:no-let
let userInstance: UserModel;
// tslint:disable-next-line:no-let
let registeredOrgDelegate1: UserModel;
// tslint:disable-next-line:no-let
let registeredOrgDelegate2: UserModel;
// tslint:disable-next-line:no-let
let noOrgDelegate: UserModel;
// tslint:disable-next-line:no-let
let validPublicAdministration: IpaPublicAdministrationModel;
// tslint:disable-next-line:no-let
let invalidPublicAdministration: IpaPublicAdministrationModel;

beforeAll(async () => {
  initIpaPublicAdministration();
  initOrganization();
  initOrganizationUser();
  initUser();
  initSession();
  initRequest();
  await IpaPublicAdministrationModel.sync({ force: true });
  await OrganizationUserModel.sync({ force: true });
  await OrganizationModel.sync({ force: true });
  await UserModel.sync({ force: true });
  await SessionModel.sync({ force: true });
  await RequestModel.sync({ force: true });

  createOrganizationAssociations();
  createUserAssociations();
  createSessionAssociations();
  createRequestAssociations();

  [
    validPublicAdministration,
    invalidPublicAdministration
  ] = await IpaPublicAdministrationModel.bulkCreate([
    validPublicAdministrationAttributes,
    {
      ...validPublicAdministrationAttributes,
      Cf: "not-compliant-fiscal-code",
      cod_amm: "invalid-administration-code"
    }
  ]);

  userInstance = await UserModel.create(userInfo, {
    include: [
      {
        as: "session",
        model: SessionModel
      }
    ]
  });
  user = userInstance.get({ plain: true }) as LoggedUser;

  registeredOrgDelegate1 = await UserModel.create(registeredOrgDelegateParams1);
  registeredOrgDelegate2 = await UserModel.create(registeredOrgDelegateParams2);
  noOrgDelegate = await UserModel.create(noOrgDelegateParams);

  const [
    registeredOrgLegalRepresentative,
    preDraftOrgLegalRepresentative,
    preDraftOrgDelegate,
    admin
  ] = await UserModel.bulkCreate([
    registeredOrgLegalRepresentativeParams,
    preDraftOrgLegalRepresentativeParams,
    preDraftOrgDelegateParams,
    adminParams
  ]);
  const [
    mockRegisteredOrganization,
    mockPreDraftOrganization
  ] = await OrganizationModel.bulkCreate([
    mockRegisteredOrganizationParams,
    mockPreDraftOrganizationParams
  ]);
  await mockRegisteredOrganization.addUser(registeredOrgDelegate1, {
    through: {
      createdAt: Date.now(),
      organizationIpaCode: mockRegisteredOrganization.ipaCode,
      updatedAt: Date.now(),
      userEmail: registeredOrgDelegate1.email
    }
  });
  await mockRegisteredOrganization.addUser(registeredOrgDelegate2, {
    through: {
      createdAt: Date.now(),
      organizationIpaCode: mockRegisteredOrganization.ipaCode,
      updatedAt: Date.now(),
      userEmail: registeredOrgDelegate2.email
    }
  });
  await mockRegisteredOrganization.addUser(registeredOrgLegalRepresentative, {
    through: {
      createdAt: Date.now(),
      organizationIpaCode: mockRegisteredOrganization.ipaCode,
      updatedAt: Date.now(),
      userEmail: registeredOrgLegalRepresentative.email
    }
  });
  await mockRegisteredOrganization.setLegalRepresentative(
    registeredOrgLegalRepresentative
  );
  await mockPreDraftOrganization.addUser(preDraftOrgDelegate, {
    through: {
      createdAt: Date.now(),
      organizationIpaCode: mockPreDraftOrganization.ipaCode,
      updatedAt: Date.now(),
      userEmail: preDraftOrgDelegate.email
    }
  });
  await mockPreDraftOrganization.setLegalRepresentative(
    preDraftOrgLegalRepresentative
  );
});

afterAll(async () => {
  await IpaPublicAdministrationModel.destroy({
    force: true,
    truncate: true
  });
  await OrganizationUserModel.destroy({
    force: true,
    truncate: true
  });
  await OrganizationModel.destroy({
    force: true,
    truncate: true
  });
  await SessionModel.destroy({
    force: true,
    where: { userEmail: userInfo.email }
  });
  await RequestModel.destroy({
    force: true,
    truncate: true
  });
  await UserModel.destroy({
    force: true,
    where: { email: userInfo.email }
  });
});

describe("OrganizationService", () => {
  describe("#createOnboardingRequest()", () => {
    const validNewOrganizationParams = {
      ipa_code: "generic_code" as NonEmptyString,
      legal_representative: {
        family_name: "Rossi" as NonEmptyString,
        fiscal_code: "RSSLRT84S20G377O" as FiscalCode,
        given_name: "Alberto" as NonEmptyString,
        phone_number: "3330000000" as NonEmptyString
      },
      request_type: RequestTypeEnum.ORGANIZATION_REGISTRATION,
      scope: OrganizationScopeEnum.LOCAL,
      selected_pec_label: "1" as NonEmptyString
    };

    describe("when the public administration is valid", () => {
      it("should return a right task with a success response containing the new request", async () => {
        const newOrganizationParams = {
          ...validNewOrganizationParams,
          ipa_code: validPublicAdministration.cod_amm
        } as OrganizationRegistrationParams;
        const expectedResult = {
          id: expect.any(Number),
          organization: {
            fiscal_code: validPublicAdministration.Cf,
            ipa_code: validPublicAdministration.cod_amm,
            legal_representative: {
              ...newOrganizationParams.legal_representative,
              email: validPublicAdministration.get(
                "mail" + newOrganizationParams.selected_pec_label
              )
            },
            name: validPublicAdministration.des_amm,
            pec: validPublicAdministration.get(
              "mail" + newOrganizationParams.selected_pec_label
            ),
            scope: newOrganizationParams.scope
          },
          requester: {
            email: user.email,
            family_name: user.familyName,
            fiscal_code: user.fiscalCode,
            given_name: user.givenName
          },
          status: RequestStatusEnum.CREATED,
          type: newOrganizationParams.request_type
        };
        const result = await createOnboardingRequest(
          newOrganizationParams,
          user
        ).run();
        expect(result).not.toBeNull();
        expect(isRight(result)).toBeTruthy();
        expect(result.value).toHaveProperty("kind", "IResponseSuccessCreation");
        expect(result.value).toHaveProperty("value", expectedResult);
      });
    });

    describe("when the public administration does not exist", () => {
      const ipaCodeOfNotExistingPublicAdministration = "not_existing_public_administration" as NonEmptyString;

      it("should return a left task with a not found error response", async () => {
        const newOrganizationParams: OrganizationRegistrationParams = {
          ...validNewOrganizationParams,
          ipa_code: ipaCodeOfNotExistingPublicAdministration
        };
        const result = await createOnboardingRequest(
          newOrganizationParams,
          user
        ).run();
        expect(result).not.toBeNull();
        expect(isLeft(result)).toBeTruthy();
        expect(result.value).toHaveProperty("kind", "IResponseErrorNotFound");
      });
    });

    describe("when the public administration is invalid", () => {
      it("should return a left task with an internal error response", async () => {
        const newOrganizationParams: OrganizationRegistrationParams = {
          ...validNewOrganizationParams,
          ipa_code: invalidPublicAdministration.cod_amm as NonEmptyString
        };
        const result = await createOnboardingRequest(
          newOrganizationParams,
          user
        ).run();
        expect(result).not.toBeNull();
        expect(isLeft(result)).toBeTruthy();
        expect(result.value).toHaveProperty("kind", "IResponseErrorInternal");
      });
    });

    describe("when the public administration is already registered", () => {
      beforeEach(async () => {
        await RequestModel.create({
          legalRepresentativeEmail: validPublicAdministration.mail1,
          legalRepresentativeFamilyName: "Spano'",
          legalRepresentativeFiscalCode: "BCDFGH12A21Z123D",
          legalRepresentativeGivenName: "Ignazio Alfonso",
          legalRepresentativePhoneNumber: "5550000000",
          organizationFiscalCode: validPublicAdministration.Cf,
          organizationIpaCode: validPublicAdministration.cod_amm,
          organizationName: validPublicAdministration.des_amm,
          organizationPec: validPublicAdministration.mail1,
          organizationScope: "NATIONAL" as OrganizationScopeEnum,
          status: RequestStatusEnum.ACCEPTED,
          type: RequestTypeEnum.ORGANIZATION_REGISTRATION,
          userEmail: user.email
        });
      });

      afterEach(async () => {
        await RequestModel.destroy({
          force: true,
          where: {
            organizationIpaCode: validPublicAdministration.cod_amm,
            status: RequestStatusEnum.ACCEPTED
          }
        });
      });
      it("should return a left task with an internal error response", async () => {
        const newOrganizationParams: OrganizationRegistrationParams = {
          ...validNewOrganizationParams,
          ipa_code: validPublicAdministration.cod_amm as NonEmptyString
        };
        const result = await createOnboardingRequest(
          newOrganizationParams,
          user
        ).run();
        expect(result).not.toBeNull();
        expect(isLeft(result)).toBeTruthy();
        expect(result.value).toHaveProperty("kind", "IResponseErrorConflict");
      });
    });
  });
});

describe("OrganizationService#getOrganizationInstanceFromDelegateEmail()", () => {
  const organizationEmail = "test@email.pec.it";
  const legalRepresentativeInfo = {
    email: organizationEmail,
    familyName: "Legale" as NonEmptyString,
    fiscalCode: "RPPLGL66S11G1239" as FiscalCode,
    givenName: "Rappresentante" as NonEmptyString,
    phoneNumber: "3330000000" as NonEmptyString,
    role: UserRoleEnum.ORG_MANAGER
  };
  const organizationInfo = {
    fiscalCode: "02438750586",
    ipaCode: "org-code",
    name: "test organization",
    pec: organizationEmail,
    scope: "NATIONAL"
  };
  beforeEach(async () => {
    const legalRepresentativeInstance = await UserModel.create(
      legalRepresentativeInfo
    );
    const organizationInstance = await OrganizationModel.create(
      organizationInfo
    );
    await organizationInstance.addUser(userInstance, {
      through: {
        createdAt: Date.now(),
        organizationIpaCode: organizationInstance.ipaCode,
        updatedAt: Date.now(),
        userEmail: user.email
      }
    });
    await organizationInstance.setLegalRepresentative(
      legalRepresentativeInstance
    );
  });

  afterEach(async () => {
    await OrganizationUserModel.destroy({
      force: true,
      where: {
        organizationIpaCode: organizationInfo.ipaCode
      }
    });
    await UserModel.destroy({
      force: true,
      where: { email: organizationEmail }
    });
    await OrganizationModel.destroy({
      force: true,
      where: {
        ipaCode: organizationInfo.ipaCode
      }
    });
  });

  it("should return a right task with some organization model if the user is the delegate of an organization", async () => {
    const errorOrOrganizationModels = await getOrganizationInstanceFromDelegateEmail(
      userInfo.email,
      organizationInfo.ipaCode
    ).run();
    expect(errorOrOrganizationModels).not.toBeNull();
    expect(isRight(errorOrOrganizationModels)).toBeTruthy();
    errorOrOrganizationModels.fold(
      () => fail(new Error("organizationModel was left instead of right")),
      organizationModels => {
        expect(organizationModels).toEqual(expect.any(Array));
        expect(organizationModels).not.toHaveLength(0);
      }
    );
  });

  it("should return a right task with none if the user is not the delegate of an organization", async () => {
    const errorOrOrganizationModels = await getOrganizationInstanceFromDelegateEmail(
      "not-delegate@email.net",
      organizationInfo.ipaCode
    ).run();
    expect(errorOrOrganizationModels).not.toBeNull();
    expect(isRight(errorOrOrganizationModels)).toBeTruthy();
    errorOrOrganizationModels.fold(
      () => fail(new Error("organizationModel was left instead of right")),
      organizationModels => {
        expect(organizationModels).toEqual(expect.any(Array));
        expect(organizationModels).toHaveLength(0);
      }
    );
  });
});

describe("OrganizationService#getOrganizationFromUserEmail()", () => {
  it("should resolve with a right value with none if the delegate has no association with any organization", async () => {
    // this is the case of a user logged it with SPID who never started any registration process
    const errorOrSomeOrganization = await getOrganizationFromUserEmail(
      noOrgDelegateParams.email
    );
    expect(errorOrSomeOrganization).not.toBeNull();
    expect(isRight(errorOrSomeOrganization)).toBeTruthy();
    errorOrSomeOrganization.fold(
      () => fail(new Error("value was left instead of right")),
      someOrganization => {
        expect(isNone(someOrganization)).toBeTruthy();
      }
    );
  });

  it("should resolve with a right value with some organization it the user is associated to an organization", async () => {
    const expectedValue = right(
      some(
        toOrganizationObject(({
          ...mockRegisteredOrganizationParams,
          legalRepresentative: registeredOrgLegalRepresentativeParams,
          users: [registeredOrgDelegate1, registeredOrgDelegate2]
        } as unknown) as OrganizationModel).fold(
          () => {
            fail("toOrganizationObject error");
          },
          value => value
        )
      )
    );

    const errorOrSomeOrganizationForDelegate1 = await getOrganizationFromUserEmail(
      registeredOrgDelegateParams1.email
    );
    expect(errorOrSomeOrganizationForDelegate1).toEqual(expectedValue);

    const errorOrSomeOrganizationForLegalRepresentative = await getOrganizationFromUserEmail(
      registeredOrgLegalRepresentativeParams.email
    );
    expect(errorOrSomeOrganizationForLegalRepresentative).toEqual(
      expectedValue
    );
  });
});

describe("OrganizationService#getOrganizationFromUserEmail()", () => {
  it("should resolve with a right value with organizations", async () => {
    const expectedValue = right([
      toOrganizationObject(({
        ...mockRegisteredOrganizationParams,
        legalRepresentative: registeredOrgLegalRepresentativeParams
      } as unknown) as OrganizationModel).fold(
        () => {
          fail("toOrganizationObject error");
        },
        value => value
      ),
      toOrganizationObject(({
        ...mockPreDraftOrganizationParams,
        legalRepresentative: preDraftOrgLegalRepresentativeParams
      } as unknown) as OrganizationModel).fold(
        () => {
          fail("toOrganizationObject error");
        },
        value => value
      )
    ]);

    const errorOrOrganizations = await getAllOrganizations();
    expect(errorOrOrganizations).toEqual(expectedValue);
  });
});

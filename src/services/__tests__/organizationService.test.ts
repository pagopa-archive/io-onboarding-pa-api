import { isLeft, isRight, right } from "fp-ts/lib/Either";
import { isNone, isSome, some } from "fp-ts/lib/Option";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { Sequelize } from "sequelize";
import { EmailAddress } from "../../generated/EmailAddress";
import { FiscalCode } from "../../generated/FiscalCode";
import { Organization } from "../../generated/Organization";
import { OrganizationFiscalCode } from "../../generated/OrganizationFiscalCode";
import { OrganizationRegistrationParams } from "../../generated/OrganizationRegistrationParams";
import { OrganizationRegistrationStatusEnum } from "../../generated/OrganizationRegistrationStatus";
import { OrganizationScopeEnum } from "../../generated/OrganizationScope";
import { UserRoleEnum } from "../../generated/UserRole";
import {
  getAllOrganizations,
  getOrganizationFromUserEmail,
  getOrganizationInstanceFromDelegateEmail,
  registerOrganization
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
  registrationStatus: OrganizationRegistrationStatusEnum.REGISTERED,
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
  registrationStatus: OrganizationRegistrationStatusEnum.PRE_DRAFT,
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

// tslint:disable-next-line:no-let
let user: LoggedUser;
// tslint:disable-next-line:no-let
let userInstance: UserModel;
// tslint:disable-next-line:no-let
let registeredOrgDelegate1: UserModel;
// tslint:disable-next-line:no-let
let registeredOrgDelegate2: UserModel;

beforeAll(async () => {
  initIpaPublicAdministration();
  initOrganization();
  initOrganizationUser();
  initUser();
  initSession();
  await IpaPublicAdministrationModel.sync({ force: true });
  await OrganizationUserModel.sync({ force: true });
  await OrganizationModel.sync({ force: true });
  await UserModel.sync({ force: true });
  await SessionModel.sync({ force: true });

  createOrganizationAssociations();
  createUserAssociations();
  createSessionAssociations();

  userInstance = await UserModel.create(userInfo, {
    include: [
      {
        as: "session",
        model: SessionModel
      }
    ]
  });
  user = userInstance.get({ plain: true }) as LoggedUser;

  [registeredOrgDelegate1, registeredOrgDelegate2] = await UserModel.bulkCreate(
    [registeredOrgDelegateParams1, registeredOrgDelegateParams2]
  );

  const [
    registeredOrgLegalRepresentative,
    preDraftOrgDelegate,
    admin,
    noOrgDelegate
  ] = await UserModel.bulkCreate([
    registeredOrgLegalRepresentativeParams,
    preDraftOrgDelegateParams,
    adminParams,
    noOrgDelegateParams
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
      userEmail: registeredOrgDelegate1.email,
      userRole: UserRoleEnum.ORG_DELEGATE
    }
  });
  await mockRegisteredOrganization.addUser(registeredOrgDelegate2, {
    through: {
      createdAt: Date.now(),
      organizationIpaCode: mockRegisteredOrganization.ipaCode,
      updatedAt: Date.now(),
      userEmail: registeredOrgDelegate2.email,
      userRole: UserRoleEnum.ORG_DELEGATE
    }
  });
  await mockRegisteredOrganization.addUser(registeredOrgLegalRepresentative, {
    through: {
      createdAt: Date.now(),
      organizationIpaCode: mockRegisteredOrganization.ipaCode,
      updatedAt: Date.now(),
      userEmail: registeredOrgLegalRepresentative.email,
      userRole: UserRoleEnum.ORG_DELEGATE
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
      userEmail: preDraftOrgDelegate.email,
      userRole: UserRoleEnum.ORG_DELEGATE
    }
  });
});

afterAll(async () => {
  await OrganizationUserModel.destroy({
    force: true,
    truncate: true
  });
  await SessionModel.destroy({
    force: true,
    where: { userEmail: userInfo.email }
  });
  await UserModel.destroy({
    force: true,
    where: { email: userInfo.email }
  });
  await OrganizationModel.destroy({
    force: true,
    truncate: true
  });
});

describe("OrganizationService", () => {
  describe("#registerOrganization()", () => {
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

    const validNewOrganizationParams: OrganizationRegistrationParams = {
      ipa_code: "generic_code" as NonEmptyString,
      legal_representative: {
        family_name: "Rossi" as NonEmptyString,
        fiscal_code: "RSSLRT84S20G377O" as FiscalCode,
        given_name: "Alberto" as NonEmptyString,
        phone_number: "3330000000" as NonEmptyString
      },
      scope: OrganizationScopeEnum.LOCAL,
      selected_pec_label: "1" as NonEmptyString
    };

    describe("when the public administration is valid", () => {
      const ipaCodeOfValidPublicAdministration = "valid_public_administration_code" as NonEmptyString;

      beforeEach(async () =>
        IpaPublicAdministrationModel.create({
          ...validPublicAdministrationAttributes,
          cod_amm: ipaCodeOfValidPublicAdministration
        })
      );

      afterEach(async () => {
        await IpaPublicAdministrationModel.destroy({
          force: true,
          where: { cod_amm: ipaCodeOfValidPublicAdministration }
        });
        await OrganizationUserModel.destroy({
          force: true,
          where: {
            organizationIpaCode: ipaCodeOfValidPublicAdministration,
            userEmail: userInfo.email
          }
        });
      });

      it("should return a right value with a success response containing the new organization", async () => {
        const newOrganizationParams: OrganizationRegistrationParams = {
          ...validNewOrganizationParams,
          ipa_code: ipaCodeOfValidPublicAdministration
        };
        const expectedResult: Organization = {
          fiscal_code: validPublicAdministrationAttributes.Cf as OrganizationFiscalCode,
          ipa_code: ipaCodeOfValidPublicAdministration,
          legal_representative: {
            ...newOrganizationParams.legal_representative,
            email: validPublicAdministrationAttributes.mail1 as EmailAddress,
            role: UserRoleEnum.ORG_MANAGER
          },
          links: [
            {
              href: `/organizations/${newOrganizationParams.ipa_code}`,
              rel: "self"
            },
            {
              href: `/organizations/${newOrganizationParams.ipa_code}`,
              rel: "edit"
            }
          ],
          name: validPublicAdministrationAttributes.des_amm as NonEmptyString,
          pec: validPublicAdministrationAttributes.mail1 as EmailAddress,
          registration_status: OrganizationRegistrationStatusEnum.PRE_DRAFT,
          scope: newOrganizationParams.scope
        };
        const result = await registerOrganization(newOrganizationParams, user);
        expect(result).not.toBeNull();
        expect(isRight(result)).toBeTruthy();
        expect(result.value).toHaveProperty(
          "kind",
          "IResponseSuccessRedirectToResource"
        );
        expect(result.value).toHaveProperty("payload", expectedResult);
        expect(result.value).toHaveProperty("resource", expectedResult);
      });
    });

    describe("when the public administration does not exist", () => {
      const ipaCodeOfNotExistingPublicAdministration = "not_existing_public_administration" as NonEmptyString;

      it("should return a left value with a not found error response", async () => {
        const newOrganizationParams: OrganizationRegistrationParams = {
          ...validNewOrganizationParams,
          ipa_code: ipaCodeOfNotExistingPublicAdministration
        };
        const result = await registerOrganization(newOrganizationParams, user);
        expect(result).not.toBeNull();
        expect(isLeft(result)).toBeTruthy();
        expect(result.value).toHaveProperty("kind", "IResponseErrorNotFound");
      });
    });

    describe("when the public administration is invalid", () => {
      const ipaCodeOfInvalidPublicAdministration = "invalid_public_administration_code" as NonEmptyString;

      beforeEach(async () =>
        IpaPublicAdministrationModel.create({
          ...validPublicAdministrationAttributes,
          Cf: "wrong_fiscal_code",
          cod_amm: ipaCodeOfInvalidPublicAdministration
        })
      );

      afterEach(async () =>
        IpaPublicAdministrationModel.destroy({
          force: true,
          where: { cod_amm: ipaCodeOfInvalidPublicAdministration }
        })
      );
      it("should return an internal error response", async () => {
        const newOrganizationParams: OrganizationRegistrationParams = {
          ...validNewOrganizationParams,
          ipa_code: ipaCodeOfInvalidPublicAdministration
        };
        const result = await registerOrganization(newOrganizationParams, user);
        expect(result).not.toBeNull();
        expect(isLeft(result)).toBeTruthy();
        expect(result.value).toHaveProperty("kind", "IResponseErrorInternal");
      });
    });

    describe("when the public administration is already registered", () => {
      const ipaCodeOfRegisteredPublicAdministration = "already_registered" as NonEmptyString;

      beforeEach(async () => {
        await IpaPublicAdministrationModel.create({
          ...validPublicAdministrationAttributes,
          cod_amm: ipaCodeOfRegisteredPublicAdministration
        });
        await OrganizationModel.create({
          fiscalCode: validPublicAdministrationAttributes.Cf,
          ipaCode: ipaCodeOfRegisteredPublicAdministration,
          name: validPublicAdministrationAttributes.des_amm,
          pec: validPublicAdministrationAttributes.mail1,
          registrationStatus: OrganizationRegistrationStatusEnum.PRE_DRAFT,
          scope: OrganizationScopeEnum.LOCAL
        });
      });

      afterEach(async () => {
        await IpaPublicAdministrationModel.destroy({
          force: true,
          where: { cod_amm: ipaCodeOfRegisteredPublicAdministration }
        });
        await OrganizationModel.destroy({
          force: true,
          where: { ipaCode: ipaCodeOfRegisteredPublicAdministration }
        });
      });
      it("should return an internal error response", async () => {
        const newOrganizationParams: OrganizationRegistrationParams = {
          ...validNewOrganizationParams,
          ipa_code: ipaCodeOfRegisteredPublicAdministration
        };
        const result = await registerOrganization(newOrganizationParams, user);
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
    registrationStatus: OrganizationRegistrationStatusEnum.PRE_DRAFT,
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
        userEmail: user.email,
        userRole: UserRoleEnum.ORG_DELEGATE
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

  it("should return a right value with some organization model if the user is the delegate of an organization", async () => {
    const maybeOrganizationModel = await getOrganizationInstanceFromDelegateEmail(
      userInfo.email,
      organizationInfo.ipaCode
    );
    expect(maybeOrganizationModel).not.toBeNull();
    expect(isRight(maybeOrganizationModel)).toBeTruthy();
    maybeOrganizationModel.fold(
      () => fail(new Error("organizationModel was left instead of right")),
      organizationModel => {
        expect(isSome(organizationModel)).toBeTruthy();
        expect(organizationModel.toNullable()).not.toBeNull();
      }
    );
  });

  it("should return a right value with none if the user is not the delegate of an organization", async () => {
    const maybeOrganizationModel = await getOrganizationInstanceFromDelegateEmail(
      "not-delegate@email.net",
      organizationInfo.ipaCode
    );
    expect(maybeOrganizationModel).not.toBeNull();
    expect(isRight(maybeOrganizationModel)).toBeTruthy();
    maybeOrganizationModel.fold(
      () => fail(new Error("organizationModel was left instead of right")),
      organizationModel => {
        expect(isSome(organizationModel)).toBeFalsy();
        expect(organizationModel.toNullable()).toBeNull();
      }
    );
  });
});

describe("OrganizationService#getOrganizationFromUserEmail()", () => {
  it("should return a right value with none if the delegate has no association with any organization", async () => {
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

  it("should return a right value with none if the delegate is associated with an organization in a PRE_DRAFT registration status", async () => {
    // this is the case of a user logged it with SPID who never started any registration process
    const errorOrSomeOrganization = await getOrganizationFromUserEmail(
      preDraftOrgDelegateParams.email
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

  it("should return a right value with some organization it the user is associated to an organization", async () => {
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
  it("should return a right value with organizations", async () => {
    const expectedValue = right([
      toOrganizationObject(({
        ...mockRegisteredOrganizationParams,
        legalRepresentative: registeredOrgLegalRepresentativeParams
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

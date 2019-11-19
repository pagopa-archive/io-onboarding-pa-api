import { isLeft, isRight } from "fp-ts/lib/Either";
import { isSome } from "fp-ts/lib/Option";
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

// tslint:disable-next-line:no-let
let user: LoggedUser;
// tslint:disable-next-line:no-let
let userInstance: UserModel;

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
});

afterAll(async () => {
  await SessionModel.destroy({
    force: true,
    where: { userEmail: userInfo.email }
  });
  await UserModel.destroy({
    force: true,
    where: { email: userInfo.email }
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

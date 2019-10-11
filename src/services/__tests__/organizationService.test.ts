import { IWithinRangeIntegerTag } from "italia-ts-commons/lib/numbers";
import { Sequelize } from "sequelize";
import { EmailAddress } from "../../generated/EmailAddress";
import { FiscalCode } from "../../generated/FiscalCode";
import { NonEmptyString } from "../../generated/NonEmptyString";
import { Organization } from "../../generated/Organization";
import { OrganizationFiscalCode } from "../../generated/OrganizationFiscalCode";
import { OrganizationRegistrationParams } from "../../generated/OrganizationRegistrationParams";
import { OrganizationScopeEnum } from "../../generated/OrganizationScope";
import { UserRoleEnum } from "../../generated/UserRole";
import { registerOrganization } from "../organizationService";

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
  firstName: "Mario",
  fiscalCode: "BNCMRA78S23G377D",
  role: UserRoleEnum.ORG_DELEGATE,
  session: {
    email: "delegate@email.net",
    expirationTime: new Date(Date.now() + 3600000),
    token: "HexToKen" as SessionToken
  }
};

// tslint:disable-next-line:no-let
let user: LoggedUser;

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

  user = (await UserModel.create(userInfo, {
    include: [
      {
        as: "session",
        model: SessionModel
      }
    ]
  })).get({ plain: true }) as LoggedUser;
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
      ipaCode: "generic_code" as NonEmptyString,
      legalRepresentative: {
        familyName: "Rossi" as NonEmptyString,
        firstName: "Alberto" as NonEmptyString,
        fiscalCode: "RSSLRT84S20G377O" as FiscalCode,
        phoneNumber: "3330000000" as NonEmptyString
      },
      scope: OrganizationScopeEnum.LOCAL,
      selectedPecIndex: 0 as number & IWithinRangeIntegerTag<0, 5>
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

      it("should return a success response containing the new organization", async () => {
        const newOrganizationParams = {
          ...validNewOrganizationParams,
          ipaCode: ipaCodeOfValidPublicAdministration
        };
        const expectedResult: Organization = {
          fiscalCode: validPublicAdministrationAttributes.Cf as OrganizationFiscalCode,
          ipaCode: ipaCodeOfValidPublicAdministration,
          legalRepresentative: {
            ...newOrganizationParams.legalRepresentative,
            email: validPublicAdministrationAttributes.mail1 as EmailAddress,
            role: UserRoleEnum.ORG_MANAGER
          },
          links: [
            {
              href: `/organizations/${newOrganizationParams.ipaCode}`,
              rel: "self"
            },
            {
              href: `/organizations/${newOrganizationParams.ipaCode}`,
              rel: "edit"
            }
          ],
          name: validPublicAdministrationAttributes.des_amm as NonEmptyString,
          pec: validPublicAdministrationAttributes.mail1 as EmailAddress,
          scope: newOrganizationParams.scope
        };
        const result = await registerOrganization(newOrganizationParams, user);
        expect(result).not.toBeNull();
        expect(result).toHaveProperty("kind", "IResponseSuccessJson");
        expect(result).toHaveProperty("value", expectedResult);
      });
    });

    describe("when the public administration does not exist", () => {
      const ipaCodeOfNotExistingPublicAdministration = "not_existing_public_administration" as NonEmptyString;

      it("should return a not found error response", async () => {
        const newOrganizationParams = {
          ...validNewOrganizationParams,
          ipaCode: ipaCodeOfNotExistingPublicAdministration
        };
        const result = await registerOrganization(newOrganizationParams, user);
        expect(result).not.toBeNull();
        expect(result).toHaveProperty("kind", "IResponseErrorNotFound");
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
        const newOrganizationParams = {
          ...validNewOrganizationParams,
          ipaCode: ipaCodeOfInvalidPublicAdministration
        };
        const result = await registerOrganization(newOrganizationParams, user);
        expect(result).not.toBeNull();
        expect(result).toHaveProperty("kind", "IResponseErrorInternal");
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
        const newOrganizationParams = {
          ...validNewOrganizationParams,
          ipaCode: ipaCodeOfRegisteredPublicAdministration
        };
        const result = await registerOrganization(newOrganizationParams, user);
        expect(result).not.toBeNull();
        expect(result).toHaveProperty("kind", "IResponseErrorConflict");
      });
    });
  });
});

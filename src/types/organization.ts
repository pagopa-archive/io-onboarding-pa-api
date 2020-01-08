import { Either } from "fp-ts/lib/Either";
import { Errors } from "io-ts";
import { errorsToReadableMessages } from "italia-ts-commons/lib/reporters";
import { FoundNotRegisteredAdministration } from "../generated/FoundNotRegisteredAdministration";
import { FoundRegisteredAdministration } from "../generated/FoundRegisteredAdministration";
import { Organization as OrganizationResult } from "../generated/Organization";
import { UserRoleEnum } from "../generated/UserRole";
import { Organization as OrganizationModel } from "../models/Organization";
import { IIpaPublicAdministrationRaw } from "./PublicAdministration";

export function fromOrganizationModelToFoundAdministration(
  organizationModel: OrganizationModel
): FoundRegisteredAdministration {
  return FoundRegisteredAdministration.decode({
    fiscal_code: organizationModel.fiscalCode,
    ipa_code: organizationModel.ipaCode,
    legal_representative: {
      family_name: organizationModel.legalRepresentative.familyName,
      fiscal_code: organizationModel.legalRepresentative.fiscalCode,
      given_name: organizationModel.legalRepresentative.givenName,
      phone_number: organizationModel.legalRepresentative.phoneNumber
    },
    links: [
      {
        href: `/organizations/${organizationModel.ipaCode}`,
        rel: "self"
      },
      {
        href: `/organizations/${organizationModel.ipaCode}`,
        rel: "edit"
      }
    ],
    name: organizationModel.name,
    pecs: { "1": organizationModel.pec },
    scope: organizationModel.scope,
    selected_pec_label: "1"
  }).fold(
    errors => {
      throw new Error(errorsToReadableMessages(errors).join(" / "));
    },
    value => value
  );
}

export function fromPublicAdministrationToFoundAdministration(
  pa: IIpaPublicAdministrationRaw
): FoundNotRegisteredAdministration {
  const pecs = [
    [pa.tipo_mail1, pa.mail1],
    [pa.tipo_mail2, pa.mail2],
    [pa.tipo_mail3, pa.mail3],
    [pa.tipo_mail4, pa.mail4],
    [pa.tipo_mail5, pa.mail5]
  ]
    .filter(([emailType, _]) => emailType === "pec")
    .reduce<{ [label: string]: string }>(
      (prev, [_, pec], index) => ({
        ...prev,
        [String(index + 1)]: pec
      }),
      {}
    );
  return FoundNotRegisteredAdministration.decode({
    fiscal_code: pa.Cf,
    ipa_code: pa.cod_amm,
    legal_representative: {
      family_name: pa.cogn_resp,
      given_name: pa.nome_resp
    },
    links: [
      {
        href: `/public-administrations/${pa.cod_amm}`,
        rel: "self"
      },
      {
        href: "/organizations",
        rel: "create"
      }
    ],
    name: pa.des_amm,
    pecs
  }).fold(
    errors => {
      throw new Error(errorsToReadableMessages(errors).join(" / "));
    },
    value => value
  );
}

export function toOrganizationObject(
  organizationInstance: OrganizationModel
): Either<Errors, OrganizationResult> {
  const legalRepresentative = {
    email: organizationInstance.legalRepresentative.email,
    family_name: organizationInstance.legalRepresentative.familyName,
    fiscal_code: organizationInstance.legalRepresentative.fiscalCode,
    given_name: organizationInstance.legalRepresentative.givenName,
    phone_number: organizationInstance.legalRepresentative.phoneNumber
  };
  const users =
    organizationInstance.users &&
    organizationInstance.users
      .filter(_ => _.role === UserRoleEnum.ORG_DELEGATE)
      .map(user => ({
        email: user.email,
        family_name: user.familyName,
        fiscal_code: user.fiscalCode,
        given_name: user.givenName,
        work_email: user.workEmail || undefined
      }));
  return OrganizationResult.decode({
    fiscal_code: organizationInstance.fiscalCode,
    ipa_code: organizationInstance.ipaCode,
    legal_representative: legalRepresentative,
    name: organizationInstance.name,
    pec: organizationInstance.pec,
    scope: organizationInstance.scope,
    users
  });
}

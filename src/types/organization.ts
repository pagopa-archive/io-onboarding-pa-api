import { errorsToReadableMessages } from "italia-ts-commons/lib/reporters";
import { FoundNotRegisteredAdministration } from "../generated/FoundNotRegisteredAdministration";
import { FoundRegisteredAdministration } from "../generated/FoundRegisteredAdministration";
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
    registration_status: organizationModel.registrationStatus,
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

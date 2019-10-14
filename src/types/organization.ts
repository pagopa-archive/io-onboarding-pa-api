import { errorsToReadableMessages } from "italia-ts-commons/lib/reporters";
import { FoundNotRegisteredAdministration } from "../generated/FoundNotRegisteredAdministration";
import { FoundRegisteredAdministration } from "../generated/FoundRegisteredAdministration";
import { Organization as OrganizationModel } from "../models/Organization";
import { IIpaPublicAdministration } from "./PublicAdministration";

export function fromOrganizationModelToFoundAdministration(
  organizationModel: OrganizationModel
): FoundRegisteredAdministration {
  return FoundRegisteredAdministration.decode({
    fiscalCode: organizationModel.fiscalCode,
    ipaCode: organizationModel.ipaCode,
    legalRepresentative: {
      familyName: organizationModel.legalRepresentative.familyName,
      fiscalCode: organizationModel.legalRepresentative.fiscalCode,
      givenName: organizationModel.legalRepresentative.givenName,
      phoneNumber: organizationModel.legalRepresentative.phoneNumber
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
    selectedPecLabel: "1"
  }).fold(
    errors => {
      throw new Error(errorsToReadableMessages(errors).join(" / "));
    },
    value => value
  );
}

export function fromPublicAdministrationToFoundAdministration(
  pa: IIpaPublicAdministration
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
    fiscalCode: pa.Cf,
    ipaCode: pa.cod_amm,
    legalRepresentative: {
      familyName: pa.cogn_resp,
      givenName: pa.nome_resp
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

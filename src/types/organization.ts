import { Organization, OrganizationScope } from "../models/Organization";
import { IIpaPublicAdministration } from "./PublicAdministration";

export interface ISearchedOrganization {
  fiscalCode: string;
  ipaCode: string;
  name: string;
  legalRepresentative: {
    familyName: string;
    firstName: string;
    fiscalCode: string | null;
    phoneNumber: string | null;
  };
  pecs: ReadonlyArray<string>;
  scope: OrganizationScope | null;
  selectedPecIndex?: number | null;
}

export function fromOrganizationModelToSearchedOrganization(
  organizationModel: Organization
): ISearchedOrganization {
  return {
    fiscalCode: organizationModel.fiscalCode,
    ipaCode: organizationModel.ipaCode,
    legalRepresentative: {
      familyName: organizationModel.legalRepresentative.familyName,
      firstName: organizationModel.legalRepresentative.firstName,
      fiscalCode: organizationModel.legalRepresentative.fiscalCode,
      phoneNumber: organizationModel.legalRepresentative.phoneNumber
    },
    name: organizationModel.name,
    pecs: [organizationModel.pec],
    scope: organizationModel.scope,
    selectedPecIndex: 0
  };
}

export function fromPublicAdministrationToSearchedOrganization(
  pa: IIpaPublicAdministration
): ISearchedOrganization {
  const pecs = [
    [pa.tipo_mail1, pa.mail1],
    [pa.tipo_mail2, pa.mail2],
    [pa.tipo_mail3, pa.mail3],
    [pa.tipo_mail4, pa.mail4],
    [pa.tipo_mail5, pa.mail5]
  ]
    .filter(([emailType, _]) => emailType === "pec")
    .map(([_, pec]) => pec);
  return {
    fiscalCode: pa.Cf,
    ipaCode: pa.cod_amm,
    legalRepresentative: {
      familyName: pa.cogn_resp,
      firstName: pa.nome_resp,
      fiscalCode: null,
      phoneNumber: null
    },
    name: pa.des_amm,
    pecs,
    scope: null
  };
}

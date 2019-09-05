import { Organization } from "../models/Organization";
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
  selectedPec?: string;
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
    selectedPec: organizationModel.pec
  };
}

export function fromPublicAdministrationToSearchedOrganization(
  pa: IIpaPublicAdministration
): ISearchedOrganization {
  // tslint:disable-next-line:readonly-array
  const pecs: string[] = [];
  if (pa.tipo_mail1 === "pec") {
    pecs.push(pa.mail1);
  }
  if (pa.tipo_mail2 === "pec") {
    pecs.push(pa.mail2);
  }
  if (pa.tipo_mail3 === "pec") {
    pecs.push(pa.mail3);
  }
  if (pa.tipo_mail4 === "pec") {
    pecs.push(pa.mail4);
  }
  if (pa.tipo_mail5 === "pec") {
    pecs.push(pa.mail5);
  }
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
    pecs
  };
}

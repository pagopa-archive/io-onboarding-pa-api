import * as t from "io-ts";
import {
  EmailString,
  NonEmptyString,
  OrganizationFiscalCode
} from "italia-ts-commons/lib/strings";

export interface IIpaPublicAdministrationRaw {
  cod_amm: string;
  des_amm: string;
  nome_resp: string;
  cogn_resp: string;
  titolo_resp: string;
  cf_validato: string;
  Cf: string;
  mail1: string;
  tipo_mail1: string;
  mail2: string;
  tipo_mail2: string;
  mail3: string;
  tipo_mail3: string;
  mail4: string;
  tipo_mail4: string;
  mail5: string;
  tipo_mail5: string;
}

const EmailOrNullLiteral = t.union(
  [EmailString, t.literal("null", "null")],
  "EmailOrNullLiteral"
);

export const IpaPublicAdministration = t.interface({
  Cf: OrganizationFiscalCode,
  cf_validato: t.literal("S"),
  cod_amm: NonEmptyString,
  cogn_resp: NonEmptyString,
  des_amm: NonEmptyString,
  mail1: EmailOrNullLiteral,
  mail2: EmailOrNullLiteral,
  mail3: EmailOrNullLiteral,
  mail4: EmailOrNullLiteral,
  mail5: EmailOrNullLiteral,
  nome_resp: NonEmptyString,
  tipo_mail1: NonEmptyString,
  tipo_mail2: NonEmptyString,
  tipo_mail3: NonEmptyString,
  tipo_mail4: NonEmptyString,
  tipo_mail5: NonEmptyString,
  titolo_resp: NonEmptyString
});

export type IpaPublicAdministration = t.TypeOf<typeof IpaPublicAdministration>;

export function isIpaPublicAdministrationProperty(
  value: string,
  ipa: IpaPublicAdministration
): value is keyof IpaPublicAdministration {
  return value in ipa;
}

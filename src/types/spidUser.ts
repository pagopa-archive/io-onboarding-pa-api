import * as t from "io-ts";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
//
import { EmailAddress } from "../../generated/io-backend/EmailAddress";
import { FiscalCode } from "../../generated/io-backend/FiscalCode";
import { SpidLevel } from "../../generated/io-backend/SpidLevel";

import { Issuer } from "./issuer";

// required attributes
export const SpidUser = t.intersection([
  t.interface({
    authnContextClassRef: SpidLevel,
    email: EmailAddress,
    familyName: t.string,
    fiscalNumber: FiscalCode,
    getAssertionXml: t.Function,
    issuer: Issuer,
    mobilePhone: NonEmptyString,
    name: t.string
  }),
  t.partial({
    nameID: t.string,
    nameIDFormat: t.string,
    sessionIndex: t.string
  })
]);

export type SpidUser = t.TypeOf<typeof SpidUser>;

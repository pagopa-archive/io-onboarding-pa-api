import { SpidLevel } from "io-spid-commons";
import * as t from "io-ts";
import {
  EmailString,
  FiscalCode,
  NonEmptyString
} from "italia-ts-commons/lib/strings";

// required attributes
export const SpidUser = t.intersection([
  t.interface({
    authnContextClassRef: SpidLevel,
    email: EmailString,
    familyName: t.string,
    fiscalNumber: FiscalCode,
    getAssertionXml: t.Function,
    issuer: t.interface({
      _: t.string
    }),
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

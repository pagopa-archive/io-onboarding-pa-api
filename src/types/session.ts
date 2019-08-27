import * as t from "io-ts";
import { UTCISODateFromString } from "italia-ts-commons/lib/dates";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { SessionToken } from "./token";

const Session = t.interface({
  createdAt: UTCISODateFromString,
  deletedAt: t.union([UTCISODateFromString, t.null], "DeletionDate"),
  expirationTime: UTCISODateFromString,
  fiscalCode: FiscalCode,
  token: SessionToken
});

type Session = t.TypeOf<typeof Session>;

export const OpenSession = t.intersection([
  Session,
  t.interface({
    deletedAt: t.null
  })
]);

export type OpenSession = t.TypeOf<typeof OpenSession>;

export const CloseSession = t.intersection([
  Session,
  t.interface({
    deletedAt: UTCISODateFromString
  })
]);

export type CloseSession = t.TypeOf<typeof CloseSession>;

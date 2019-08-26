// required attributes
import * as t from "io-ts";
import { UTCISODateFromString } from "italia-ts-commons/lib/dates";
import { SessionToken } from "./token";

export const Session = t.interface({
  createdAt: UTCISODateFromString,
  expirationTime: UTCISODateFromString,
  token: SessionToken
});

export type Session = t.TypeOf<typeof Session>;

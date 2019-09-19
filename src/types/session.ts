import * as t from "io-ts";
import { UTCISODateFromString } from "italia-ts-commons/lib/dates";
import { EmailString } from "italia-ts-commons/lib/strings";
import { SessionToken } from "./token";

/**
 * A session interface.
 */
const Session = t.interface({
  createdAt: UTCISODateFromString,
  deletedAt: t.union([UTCISODateFromString, t.null], "DeletionDate"),
  email: EmailString,
  expirationTime: UTCISODateFromString,
  token: SessionToken
});

type Session = t.TypeOf<typeof Session>;

/**
 * A session which has not been closed by the user,
 * i.e. a session the user has not performed a logout within
 * regardless of whether it has expired or not.
 */
export const NotClosedSession = t.intersection([
  Session,
  t.interface({
    deletedAt: t.null
  })
]);

export type NotClosedSession = t.TypeOf<typeof NotClosedSession>;

/**
 * A session which has been closed by the user,
 * i.e. a session the user performed a logout within
 * before its expiration.
 */
export const ClosedSession = t.intersection([
  Session,
  t.interface({
    deletedAt: UTCISODateFromString
  })
]);

export type ClosedSession = t.TypeOf<typeof ClosedSession>;

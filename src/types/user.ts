import { Request } from "express";
import { Either, left, right } from "fp-ts/lib/Either";
import {
  getAuthnContextFromResponse,
  isSpidL,
  SpidLevel,
  SpidLevelEnum
} from "io-spid-commons";
import * as t from "io-ts";
import { UTCISODateFromString } from "italia-ts-commons/lib/dates";
import { errorsToReadableMessages } from "italia-ts-commons/lib/reporters";
import { IResponseErrorValidation } from "italia-ts-commons/lib/responses";
import {
  EmailString,
  FiscalCode,
  NonEmptyString
} from "italia-ts-commons/lib/strings";

import { UserRole } from "../generated/UserRole";
import { log } from "../utils/logger";
import { withValidatedOrValidationError } from "../utils/responses";

import { NotClosedSession } from "./session";

export const LoggedUser = t.intersection([
  t.interface({
    createdAt: UTCISODateFromString,
    email: EmailString,
    familyName: NonEmptyString,
    fiscalCode: FiscalCode,
    givenName: NonEmptyString,
    role: UserRole,
    session: NotClosedSession
  }),
  t.partial({
    workEmail: EmailString
  })
]);

export type LoggedUser = t.TypeOf<typeof LoggedUser>;

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
    name: t.string
  }),
  t.partial({
    nameId: t.string,
    nameIdFormat: t.string,
    sessionIndex: t.string
  })
]);

export type SpidUser = t.TypeOf<typeof SpidUser>;

/**
 * Validates a SPID User extracted from a SAML response.
 */
export function validateSpidUser(value: unknown): Either<string, SpidUser> {
  if (typeof value !== "object") {
    return left("User is not an object");
  }
  if (!value) {
    return left("User is null");
  }
  if (!value.hasOwnProperty("fiscalNumber")) {
    return left("Cannot decode a user without a fiscalNumber");
  }

  // Remove the international prefix from fiscal number.
  const FISCAL_NUMBER_INTERNATIONAL_PREFIX = "TINIT-";
  const fiscalNumberWithoutPrefix = (value as {
    fiscalNumber: string;
  }).fiscalNumber.replace(FISCAL_NUMBER_INTERNATIONAL_PREFIX, "");

  if (!value.hasOwnProperty("getAssertionXml")) {
    return left("Cannot decode a user object without getAssertionXml property");
  }
  const maybeAuthnContextClassRef = getAuthnContextFromResponse(
    (value as {
      getAssertionXml: () => string;
    }).getAssertionXml()
  );

  // Set SPID level to a default (SPID_L2) if the expected value is not available
  // in the SAML assertion.
  // Actually the value returned by the test idp is invalid
  // @see https://github.com/italia/spid-testenv/issues/26
  const authnContextClassRef = maybeAuthnContextClassRef
    .filter(isSpidL)
    .getOrElse(SpidLevelEnum["https://www.spid.gov.it/SpidL2"]);

  log.info(
    "Response from IDP (authnContextClassRef): %s",
    authnContextClassRef
  );

  if (
    authnContextClassRef === SpidLevelEnum["https://www.spid.gov.it/SpidL1"]
  ) {
    return left(
      `Insufficient SPID authorization level: ${authnContextClassRef}`
    );
  }

  const valueWithoutPrefix = {
    ...value,
    fiscalNumber: fiscalNumberWithoutPrefix
  };

  const valueWithDefaultSPIDLevel = {
    ...valueWithoutPrefix,
    authnContextClassRef
  };

  if (
    value.hasOwnProperty("issuer") &&
    value.hasOwnProperty("authnContextClassRef")
  ) {
    const issuer = (value as { issuer: unknown }).issuer;

    const issuerName =
      typeof issuer === "object" &&
      issuer !== null &&
      issuer.hasOwnProperty("_")
        ? (issuer as { _: unknown })._
        : undefined;
    const originalAuthnContextClassRef = value.hasOwnProperty(
      "authContextClassRef"
    )
      ? (value as { authContextClassRef: unknown }).authContextClassRef
      : undefined;
    // Log the invalid SPID level to audit IDP responses.
    if (!isSpidL(valueWithDefaultSPIDLevel.authnContextClassRef)) {
      log.warn(
        "Response from IDP: %s doesn't contain a valid SPID level: %s",
        issuerName,
        originalAuthnContextClassRef
      );
    }
  }

  const result = SpidUser.decode(valueWithDefaultSPIDLevel);

  return result.isLeft()
    ? left(
        "Cannot validate SPID user object: " +
          errorsToReadableMessages(result.value).join(" / ")
      )
    : right(result.value);
}

export const withUserFromRequest = async <T>(
  req: Request,
  f: (user: LoggedUser) => Promise<T>
): Promise<IResponseErrorValidation | T> =>
  withValidatedOrValidationError(LoggedUser.decode(req.user), f);

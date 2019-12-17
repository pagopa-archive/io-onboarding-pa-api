import { Errors } from "io-ts";
import { errorsToReadableMessages } from "italia-ts-commons/lib/reporters";
import { ResponseErrorInternal } from "italia-ts-commons/lib/responses";
import { log } from "./logger";

export const genericInternalUnknownErrorHandler = (
  error: unknown,
  logMessage: string,
  errorDetail: string
) => {
  log.error(logMessage + " %s", error);
  return ResponseErrorInternal(errorDetail);
};

export const genericInternalValidationErrorsHandler = (
  errors: Errors,
  logMessage: string,
  errorDetail: string
) => {
  log.error(logMessage + " %s", errorsToReadableMessages(errors).join(" / "));
  return ResponseErrorInternal(errorDetail);
};

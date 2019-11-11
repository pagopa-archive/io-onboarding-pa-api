import * as t from "io-ts";
import { errorsToReadableMessages } from "italia-ts-commons/lib/reporters";
import {
  IResponse,
  ResponseErrorInternal,
  ResponseErrorValidation
} from "italia-ts-commons/lib/responses";
import { log } from "./logger";

/**
 * Interface for a no content response returning a empty object.
 */
export interface IResponseNoContent extends IResponse<"IResponseNoContent"> {
  readonly value: {};
}

/**
 * Interface for response returning a PDF file.
 */
export interface IResponseDownload extends IResponse<"IResponseDownload"> {}

/**
 * Returns a pdf document.
 */
export const ResponseDownload = (
  path: string,
  detail = "Internal server error"
): IResponseDownload => {
  return {
    apply: res =>
      res.status(200).download(path, error => {
        if (error) {
          log.error("Error sending file. %s", error);
          if (!res.headersSent) {
            ResponseErrorInternal(detail).apply(res);
          }
        }
      }),
    kind: "IResponseDownload"
  };
};

/**
 * Transforms async failures into internal errors
 */
export const withCatchAsInternalError = <T>(
  f: () => Promise<T>,
  message: string = "Exception while calling upstream API (likely a timeout)."
) =>
  f().catch(_ => {
    // tslint:disable-next-line:no-console
    console.error(_);
    return ResponseErrorInternal(`${message} [${_}]`);
  });

/**
 * Calls the provided function with the valid response, or else returns an
 * IResponseErrorValidation with the validation errors.
 */
export const withValidatedOrValidationError = <T, U>(
  response: t.Validation<T>,
  f: (t: T) => U
) =>
  response.isLeft()
    ? ResponseErrorValidation(
        "Bad request",
        errorsToReadableMessages(response.value).join(" / ")
      )
    : f(response.value);

/**
 * Calls the provided function with the valid response, or else returns an
 * IResponseErrorInternal with the validation errors.
 */
export const withValidatedOrInternalError = <T, U>(
  validated: t.Validation<T>,
  f: (t: T) => U
) =>
  validated.isLeft()
    ? ResponseErrorInternal(
        errorsToReadableMessages(validated.value).join(" / ")
      )
    : f(validated.value);

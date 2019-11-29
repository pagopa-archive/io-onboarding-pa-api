import { Response } from "express";
import * as t from "io-ts";
import { errorsToReadableMessages } from "italia-ts-commons/lib/reporters";
import {
  IResponse,
  ProblemJson,
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
 * Returns a no content json response.
 */
export function ResponseNoContent(): IResponseNoContent {
  return {
    apply: (res: Response) => res.status(204).json({}),
    kind: "IResponseNoContent",
    value: {}
  };
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
 * Interface for a response describing an unsupported media type error (415).
 */
export interface IResponseErrorUnsupportedMediaType
  extends IResponse<"IResponseErrorUnsupportedMediaType"> {}

/**
 * Returns a response describing an unsupported media type error (415).
 */
export function ResponseErrorUnsupportedMediaType(
  detail: string
): IResponseErrorUnsupportedMediaType {
  const status = 415;
  const title = "Unsupported Media type";
  const problem: ProblemJson = {
    detail,
    status,
    title
  };
  return {
    apply: res =>
      res
        .status(status)
        .set("Content-Type", "application/problem+json")
        .json(problem),
    detail: `${title}: ${detail}`,
    kind: "IResponseErrorUnsupportedMediaType"
  };
}

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

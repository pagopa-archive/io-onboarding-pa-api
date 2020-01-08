import { Response } from "express";
import { Either, isLeft } from "fp-ts/lib/Either";
import { fromEither } from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import { errorsToReadableMessages } from "italia-ts-commons/lib/reporters";
import {
  IResponse,
  ResponseErrorInternal,
  ResponseErrorValidation
} from "italia-ts-commons/lib/responses";
import { log } from "./logger";

/**
 * Interface for a successful creation response returning a json object (201 HTTP status).
 */
export interface IResponseSuccessCreation<T>
  extends IResponse<"IResponseSuccessCreation"> {
  readonly value: T;
}

/**
 * Returns a successful json creation response (201 HTTP status).
 */
export function ResponseSuccessCreation<T>(o: T): IResponseSuccessCreation<T> {
  const kindlessObject = Object.assign(Object.assign({}, o), {
    kind: undefined
  });
  return {
    apply: res => res.status(201).json(kindlessObject),
    kind: "IResponseSuccessCreation",
    value: o
  };
}

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
 * IResponseErrorValidation with the validation errors.
 */
export const withValidationOrError = <T>(response: t.Validation<T>) =>
  fromEither(response).mapLeft(errors =>
    ResponseErrorValidation(
      "Bad request",
      errorsToReadableMessages(errors).join(" / ")
    )
  );

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

/**
 * Calls the provided function with the valid value, or else returns an
 * IResponseErrorInternal with the error.
 */
export const withResultOrInternalError = <T, U>(
  errorOrResult: Either<Error, T>,
  f: (t: T) => U
) => {
  if (isLeft(errorOrResult)) {
    log.error("An error occurred. %s", errorOrResult.value);
    return ResponseErrorInternal(
      `Internal server error. ${errorOrResult.value}"`
    );
  }
  return f(errorOrResult.value);
};

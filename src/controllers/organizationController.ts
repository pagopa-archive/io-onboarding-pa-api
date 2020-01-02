import { Request as ExpressRequest } from "express";
import { array } from "fp-ts/lib/Array";
import { left } from "fp-ts/lib/Either";
import {
  fromEither,
  fromPredicate,
  taskEither,
  TaskEither,
  tryCatch
} from "fp-ts/lib/TaskEither";
import * as fs from "fs";
import { Errors } from "io-ts";
import {
  IResponseErrorConflict,
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorConflict,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorInternal,
  ResponseErrorNotFound,
  ResponseErrorValidation,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import accessControl, { Resource } from "../acl/acl";
import { AdministrationSearchParam } from "../generated/AdministrationSearchParam";
import { AdministrationSearchResult } from "../generated/AdministrationSearchResult";
import { OrganizationCollection } from "../generated/OrganizationCollection";
import { OrganizationRegistrationParams } from "../generated/OrganizationRegistrationParams";
import { OrganizationRegistrationRequest } from "../generated/OrganizationRegistrationRequest";
import { Request } from "../generated/Request";
import { RequestIdCollection } from "../generated/RequestIdCollection";
import { RequestStatusEnum } from "../generated/RequestStatus";
import { UserDelegationRequest } from "../generated/UserDelegationRequest";
import { UserRoleEnum } from "../generated/UserRole";
import localeIt from "../locales/it";
import {
  Request as RequestModel,
  RequestScope,
  RequestType
} from "../models/Request";
import DocumentService from "../services/documentService";
import EmailService from "../services/emailService";
import {
  createOnboardingRequest,
  findAllNotPreDraft,
  getAllOrganizations,
  getOrganizationFromUserEmail
} from "../services/organizationService";
import { LoggedUser, withUserFromRequest } from "../types/user";
import {
  genericInternalUnknownErrorHandler,
  genericInternalValidationErrorsHandler
} from "../utils/errorHandlers";
import { log } from "../utils/logger";
import {
  IResponseDownload,
  IResponseNoContent,
  IResponseSuccessCreation,
  ResponseDownload,
  ResponseNoContent,
  withCatchAsInternalError,
  withValidatedOrValidationError,
  withValidationOrError
} from "../utils/responses";

type IResponseError =
  // tslint:disable-next-line:max-union-size
  | IResponseErrorConflict
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorInternal
  | IResponseErrorNotFound
  | IResponseErrorValidation;

export default class OrganizationController {
  constructor(
    private readonly documentService: DocumentService,
    private readonly emailService: EmailService
  ) {}

  public async findPublicAdministration(
    req: ExpressRequest
  ): Promise<
    | IResponseErrorValidation
    | IResponseErrorInternal
    | IResponseSuccessJson<AdministrationSearchResult>
  > {
    return withValidatedOrValidationError(
      AdministrationSearchParam.decode(req.query.search),
      searchParam =>
        withCatchAsInternalError(
          async () =>
            ResponseSuccessJson({
              administrations: await findAllNotPreDraft(searchParam)
            }),
          "Internal message error"
        )
    );
  }

  public registerOrganization(
    req: ExpressRequest
  ): TaskEither<
    IResponseError,
    IResponseSuccessCreation<
      OrganizationRegistrationRequest | UserDelegationRequest
    >
  > {
    interface ITaskResults {
      organizationRegistrationParams: OrganizationRegistrationParams;
      successResponse: IResponseSuccessCreation<
        OrganizationRegistrationRequest | UserDelegationRequest
      >;
      user: LoggedUser;
    }
    return fromEither<Errors, Pick<ITaskResults, "user">>(
      LoggedUser.decode(req.user).map(user => ({
        user
      }))
    )
      .mapLeft<IResponseError>((errors: Errors) =>
        genericInternalValidationErrorsHandler(
          errors,
          "organizationController#registerOrganization | Invalid internal data.",
          "Invalid internal data."
        )
      )
      .chain(
        fromPredicate(
          taskResults =>
            accessControl
              .can(taskResults.user.role)
              .createOwn(Resource.ORGANIZATION).granted,
          () => ResponseErrorForbiddenNotAuthorized
        )
      )
      .chain(taskResults =>
        withValidationOrError(
          OrganizationRegistrationParams.decode(req.body)
        ).map(organizationRegistrationParams => ({
          organizationRegistrationParams,
          user: taskResults.user
        }))
      )
      .chain<ITaskResults>(taskResults =>
        createOnboardingRequest(
          taskResults.organizationRegistrationParams,
          taskResults.user
        ).map(successResponse => ({ ...taskResults, successResponse }))
      )
      .chain(taskResults =>
        this.createOnboardingDocument(taskResults.successResponse)
      );
  }

  public getOrganizations(
    req: ExpressRequest
  ): Promise<
    // tslint:disable-next-line:max-union-size
    | IResponseErrorValidation
    | IResponseErrorInternal
    | IResponseErrorForbiddenNotAuthorized
    | IResponseSuccessJson<OrganizationCollection>
  > {
    return withUserFromRequest(req, async user => {
      const userPermissions = accessControl.can(user.role);
      const handleError = (error: Error) => {
        log.error(
          "An error occurred while reading from the database. %s",
          error
        );
        return ResponseErrorInternal(
          "An error occurred while reading from the database."
        );
      };
      if (userPermissions.readAny(Resource.ORGANIZATION).granted) {
        const errorOrOrganizations = await getAllOrganizations();
        return errorOrOrganizations.fold<
          IResponseErrorInternal | IResponseSuccessJson<OrganizationCollection>
        >(handleError, organizations => {
          return ResponseSuccessJson({
            items: organizations
          });
        });
      } else if (userPermissions.readOwn(Resource.ORGANIZATION).granted) {
        const errorOrMaybeOrganization = await getOrganizationFromUserEmail(
          user.email
        );
        return errorOrMaybeOrganization.fold<
          IResponseErrorInternal | IResponseSuccessJson<OrganizationCollection>
        >(handleError, maybeOrganization =>
          maybeOrganization
            .map<
              | IResponseErrorInternal
              | IResponseSuccessJson<OrganizationCollection>
            >(organization =>
              ResponseSuccessJson({
                items: [organization]
              })
            )
            .getOrElse(
              // A legal representative must always be associated to the organization that he represents.
              // If no organization is found for a legal representative, then the stored data are not consistent.
              user.role === UserRoleEnum.ORG_MANAGER
                ? ResponseErrorInternal(
                    "Could not find the organization associated to the user"
                  )
                : ResponseSuccessJson({ items: [] })
            )
        );
      } else {
        return ResponseErrorForbiddenNotAuthorized;
      }
    });
  }

  public getDocument(
    req: ExpressRequest
  ): Promise<
    // tslint:disable-next-line:max-union-size
    | IResponseErrorValidation
    | IResponseErrorForbiddenNotAuthorized
    | IResponseErrorNotFound
    | IResponseErrorInternal
    | IResponseDownload
  > {
    return withUserFromRequest(req, async user => {
      const userPermissions = accessControl.can(user.role);
      if (!userPermissions.readOwn(Resource.UNSIGNED_DOCUMENT).granted) {
        return ResponseErrorForbiddenNotAuthorized;
      }
      const filePath = `./documents/${req.params.ipaCode}/${req.params.fileName}`;
      try {
        await fs.promises.access(filePath);
        return ResponseDownload(filePath);
      } catch (error) {
        return ResponseErrorNotFound(
          "Not found",
          "The requested document does not exist"
        );
      }
    });
  }

  /**
   * Submits an onboarding request by sending to the related administration an email containing the requested signed documents.
   * In order to achieve the result, this method performs several steps:
   * 1. Fetches the user from the request
   * 2. Checks the user permissions
   * 3. Validates the body request
   * 4. Fetches and validates the requests to be submitted
   * 5. Creates the requested signed documents
   * 6. Sends the documents via email
   * 7. Updates the status of the requests
   *
   * If any error occurs during any step of the process, a proper error response is sent to the client; otherwise, a response with no content is sent.
   * @param req The client request
   */
  public sendDocuments(
    req: ExpressRequest
  ): TaskEither<IResponseError, IResponseNoContent> {
    interface ITaskResults {
      attachments: ReadonlyArray<{
        filename: string;
        path: string;
      }>;
      requestIds: ReadonlyArray<number>;
      requestModels: ReadonlyArray<RequestModel>;
      user: LoggedUser;
    }
    const internalUnknownErrorHandler = (error: unknown, message: string) =>
      genericInternalUnknownErrorHandler(
        error,
        `organizationController#sendDocuments | ${message}`,
        message
      );
    return fromEither<Errors, Pick<ITaskResults, "user">>(
      LoggedUser.decode(req.user).map(user => ({
        user
      }))
    )
      .mapLeft<IResponseError>((errors: Errors) =>
        genericInternalValidationErrorsHandler(
          errors,
          "organizationController#sendDocuments | Invalid internal data.",
          "Invalid internal data."
        )
      )
      .chain(
        fromPredicate(
          taskResults =>
            accessControl
              .can(taskResults.user.role)
              .createOwn(Resource.SIGNED_DOCUMENT).granted,
          () => ResponseErrorForbiddenNotAuthorized
        )
      )
      .chain<Pick<ITaskResults, "user" | "requestIds">>(taskResults =>
        withValidationOrError(RequestIdCollection.decode(req.body))
          .chain(
            fromPredicate(
              _ => _.items.length > 0,
              () =>
                ResponseErrorValidation(
                  "Bad request",
                  "No request ids provided"
                )
            )
          )

          .map(requestIdCollection => ({
            requestIds: requestIdCollection.items,
            user: taskResults.user
          }))
      )
      .chain<Pick<ITaskResults, "requestModels">>(taskResults =>
        array
          .traverse(taskEither)([...taskResults.requestIds], requestId =>
            tryCatch<IResponseError, RequestModel>(
              () =>
                RequestModel.scope(RequestScope.INCLUDE_REQUESTER).findOne({
                  where: { id: requestId }
                }),
              error =>
                internalUnknownErrorHandler(
                  error,
                  "An error occurred while reading from the database."
                )
            )
              .chain(
                fromPredicate(
                  _ => _ !== null,
                  () =>
                    ResponseErrorNotFound(
                      "Request not found",
                      `The request ${requestId} does not exist`
                    )
                )
              )
              .chain(
                fromPredicate(
                  _ =>
                    _.type === RequestType.USER_DELEGATION ||
                    _.type === RequestType.ORGANIZATION_REGISTRATION,
                  () =>
                    ResponseErrorValidation(
                      "Bad request",
                      `The type of request ${requestId} is invalid`
                    )
                )
              )
              .chain(
                fromPredicate(
                  _ => _.requester !== null,
                  () => ResponseErrorInternal("Invalid internal data")
                )
              )
              .chain(
                fromPredicate(
                  _ => _.requester!.email === taskResults.user.email,
                  () => ResponseErrorForbiddenNotAuthorized
                )
              )
              .chain(
                fromPredicate(
                  _ => _.status === RequestStatusEnum.CREATED,
                  () =>
                    ResponseErrorConflict(
                      `The document for the request ${requestId} has already been sent.`
                    )
                )
              )
          )
          .chain(
            fromPredicate(
              _ =>
                _.every((request, index, requests) =>
                  index === 0
                    ? true
                    : request.organizationPec ===
                      requests[index - 1].organizationPec
                ),
              () =>
                ResponseErrorConflict(
                  `The requests should be sent to different email addresses.`
                )
            )
          )
          .map(requestModels => ({ requestModels }))
      )
      .chain(taskResults =>
        array
          .traverse(taskEither)(
            [...taskResults.requestModels],
            requestModel => {
              // TODO:
              //  the documents must be stored on cloud (Azure Blob Storage).
              //  @see https://www.pivotaltracker.com/story/show/169644958
              const documentName = `${requestModel.id}.pdf`;
              const unsignedDocumentPath = `./documents/unsigned/${documentName}`;
              const signedDocumentPath = `./documents/signed/${documentName}`;
              return this.createSignedDocument(
                unsignedDocumentPath,
                signedDocumentPath
              ).map(() => ({
                filename: `documento-${requestModel.id}.pdf`,
                path: signedDocumentPath
              }));
            }
          )
          .map(attachments => ({
            attachments,
            requestModels: taskResults.requestModels
          }))
      )
      .chain(taskResults =>
        tryCatch(
          () =>
            this.emailService.send({
              attachments: taskResults.attachments,
              html:
                localeIt.organizationController.sendDocuments.registrationEmail
                  .content,
              subject:
                localeIt.organizationController.sendDocuments.registrationEmail
                  .subject,
              text:
                localeIt.organizationController.sendDocuments.registrationEmail
                  .content,
              to: taskResults.requestModels[0].organizationPec
            }),
          error =>
            internalUnknownErrorHandler(
              error,
              "An error occurred while sending email."
            )
        ).map(() => taskResults)
      )
      .chain(taskResults =>
        array
          .traverse(taskEither)([...taskResults.requestModels], requestModel =>
            tryCatch(
              () =>
                requestModel.update({
                  status: RequestStatusEnum.SUBMITTED
                }),
              error =>
                internalUnknownErrorHandler(
                  error,
                  "An error occurred while updating request status."
                )
            )
          )
          .map(_ => ResponseNoContent())
      );
  }

  private createOnboardingDocument(
    requestsCreationResponseSuccess: IResponseSuccessCreation<
      OrganizationRegistrationRequest | UserDelegationRequest
    >
  ): TaskEither<
    IResponseErrorInternal,
    IResponseSuccessCreation<
      OrganizationRegistrationRequest | UserDelegationRequest
    >
  > {
    // TODO:
    //  the documents must be stored on cloud (Azure Blob Storage).
    //  @see https://www.pivotaltracker.com/story/show/169644958
    const outputFolder = `./documents/unsigned`;
    const createDocumentPerRequest = (request: Request) => {
      const documentPath = `${outputFolder}/${request.id}.pdf`;
      if (OrganizationRegistrationRequest.is(request)) {
        return this.documentService.generateDocument(
          request.id.toString(),
          localeIt.organizationController.registerOrganization.contract.replace(
            "%s",
            `${request.organization.ipa_code} ${request.organization.fiscal_code}`
          ),
          documentPath
        );
      }
      if (UserDelegationRequest.is(request)) {
        return this.documentService.generateDocument(
          request.id.toString(),
          // TODO:
          //  refactor this operation using an internationalization framework allowing params interpolation in strings.
          //  @see https://www.pivotaltracker.com/story/show/169644146
          localeIt.organizationController.registerOrganization.delegation
            .replace(
              "%legalRepresentative%",
              `${request.organization.legal_representative.given_name} ${request.organization.legal_representative.family_name}`
            )
            .replace("%organizationName%", request.organization.name)
            .replace(
              "%delegate%",
              `${request.requester.given_name} ${request.requester.family_name}`
            ),
          documentPath
        );
      }
      return fromEither(left(new Error("Wrong data")));
    };
    return tryCatch(
      () => fs.promises.mkdir(outputFolder, { recursive: true }),
      (error: unknown) =>
        genericInternalUnknownErrorHandler(
          error,
          "organizationController#createOnboardingDocument | An error occurred creating documents folder.",
          "An error occurred creating documents folder."
        )
    )
      .chain(() =>
        createDocumentPerRequest(requestsCreationResponseSuccess.value).mapLeft(
          error =>
            genericInternalUnknownErrorHandler(
              error,
              "organizationController#createOnboardingDocument | An error occurred during document generation.",
              "An error occurred during document generation."
            )
        )
      )
      .map(() => requestsCreationResponseSuccess);
  }

  private createSignedDocument(
    inputPath: string,
    outputPath: string
  ): TaskEither<IResponseErrorInternal, void> {
    return tryCatch(
      () => fs.promises.mkdir("./documents/signed", { recursive: true }),
      (error: unknown) =>
        genericInternalUnknownErrorHandler(
          error,
          "organizationController#createOnboardingDocument | An error occurred creating documents folder.",
          "An error occurred creating documents folder."
        )
    )
      .chain(() =>
        tryCatch(
          () =>
            fs.promises.readFile(inputPath, {
              encoding: "base64"
            }),
          error =>
            genericInternalUnknownErrorHandler(
              error,
              "OrganizationController#createSignedDocument | An error occurred while reading unsigned document file.",
              "An error occurred while reading unsigned document file"
            )
        )
      )
      .chain(unsignedDocumentContent =>
        this.documentService
          .signDocument(unsignedDocumentContent)
          .mapLeft(error =>
            genericInternalUnknownErrorHandler(
              error,
              "OrganizationController#createSignedDocument | An error occurred while signing the document.",
              "An error occurred while signing the document."
            )
          )
      )
      .chain(signedContentBase64 =>
        tryCatch(
          () =>
            fs.promises.writeFile(outputPath, signedContentBase64, {
              encoding: "base64"
            }),
          error =>
            genericInternalUnknownErrorHandler(
              error,
              "OrganizationController#createSignedDocument | An error occurred while saving signed document file.",
              "An error occurred while saving signed document file"
            )
        )
      );
  }
}

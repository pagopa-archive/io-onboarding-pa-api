import { Request as ExpressRequest } from "express";
import { array } from "fp-ts/lib/Array";
import {
  fromEither,
  fromLeft,
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
import { ActionPayload } from "../generated/ActionPayload";
import { AdministrationSearchParam } from "../generated/AdministrationSearchParam";
import { AdministrationSearchResult } from "../generated/AdministrationSearchResult";
import { OrganizationCollection } from "../generated/OrganizationCollection";
import { OrganizationRegistrationParams } from "../generated/OrganizationRegistrationParams";
import { OrganizationRegistrationRequest } from "../generated/OrganizationRegistrationRequest";
import { Request } from "../generated/Request";
import { RequestActionEnum } from "../generated/RequestAction";
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

export default class RequestController {
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
          "requestController#registerOrganization | Invalid internal data.",
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
   * Performs an action on a bulk of requests, after fetching the user from the request and validating the payload.
   * @param req The client request
   */
  public handleAction(
    req: ExpressRequest
  ): TaskEither<IResponseError, IResponseNoContent> {
    interface ITaskResults {
      requestIds: ReadonlyArray<number>;
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
          "requestController#handleAction | Invalid internal data.",
          "Invalid internal data."
        )
      )
      .chain(taskResults =>
        withValidationOrError(ActionPayload.decode(req.body))
          .chain(
            fromPredicate(
              _ => _.ids.length > 0,
              () =>
                ResponseErrorValidation(
                  "Bad request",
                  "No request ids provided"
                )
            )
          )
          .map(actionPayload => ({ actionPayload, user: taskResults.user }))
      )
      .chain(taskResults => {
        if (
          taskResults.actionPayload.type ===
          RequestActionEnum.SEND_REGISTRATION_REQUEST_EMAIL_TO_ORG
        ) {
          return this.sendEmailWithDocumentsToOrganizationPec(
            taskResults.user,
            taskResults.actionPayload.ids
          );
        }
        const unhandledActionMessage = "Unhandled action.";
        log.error(`requestController#handleAction | ${unhandledActionMessage}`);
        return fromLeft<IResponseErrorNotFound, IResponseNoContent>(
          ResponseErrorNotFound("Not found", unhandledActionMessage)
        );
      });
  }

  /**
   * Submits an onboarding request by sending to the related administration an email containing the requested signed documents.
   * In order to achieve the result, this method performs several steps:
   * 1. Checks the user permissions
   * 2. Fetches and validates the requests to be submitted
   * 3. Creates the requested signed documents
   * 4. Sends the documents via email
   * 5. Updates the status of the requests
   *
   * If any error occurs during any step of the process, a proper error response is sent to the client; otherwise, a response with no content is sent.
   * @param loggedUser The user performing the action
   * @param requestIds The requests performing the action
   */
  private sendEmailWithDocumentsToOrganizationPec(
    loggedUser: LoggedUser,
    requestIds: ReadonlyArray<number>
  ): TaskEither<IResponseError, IResponseNoContent> {
    const internalUnknownErrorHandler = (error: unknown, message: string) =>
      genericInternalUnknownErrorHandler(
        error,
        `requestController#sendEmailWithDocumentsToOrganizationPec | ${message}`,
        message
      );
    return ![
      Resource.ORGANIZATION_REGISTRATION_REQUEST,
      Resource.USER_DELEGATION_REQUEST
    ].every(
      resource => accessControl.can(loggedUser.role).updateOwn(resource).granted
    )
      ? fromLeft(ResponseErrorForbiddenNotAuthorized)
      : array
          .traverse(taskEither)([...requestIds], requestId =>
            this.getValidRequest(requestId, loggedUser.email)
          )
          .chain(
            // Check that all the requests are to be sent to the same email address or return an error
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
                    localeIt.requestController
                      .sendEmailWithDocumentsToOrganizationPec.registrationEmail
                      .content,
                  subject:
                    localeIt.requestController
                      .sendEmailWithDocumentsToOrganizationPec.registrationEmail
                      .subject,
                  text:
                    localeIt.requestController
                      .sendEmailWithDocumentsToOrganizationPec.registrationEmail
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
              .traverse(taskEither)(
                [...taskResults.requestModels],
                requestModel =>
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

  /**
   * Returns the request if it can be submitted by the user or an error response
   * @param requestId The id of the required request
   * @param userEmail The email of the user
   */
  private getValidRequest(
    requestId: number,
    userEmail: string
  ): TaskEither<IResponseError, RequestModel> {
    const dbError = "An error occurred while reading from the database";
    return tryCatch<IResponseError, RequestModel>(
      () =>
        RequestModel.scope(RequestScope.INCLUDE_REQUESTER).findOne({
          where: { id: requestId }
        }),
      error =>
        genericInternalUnknownErrorHandler(
          error,
          `requestController#getSubmittableResourceOrErrorResponse | ${dbError}`,
          dbError
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
          _ => _.get("requester") !== null, // direct access to the property does not work in test execution
          () => ResponseErrorInternal("Invalid internal data")
        )
      )
      .chain(
        fromPredicate(
          // tslint:disable-next-line:no-useless-cast
          _ => _.get("requester")!.email === userEmail, // direct access to the property does not work in test execution
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
          localeIt.requestController.registerOrganization.contract.replace(
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
          localeIt.requestController.registerOrganization.delegation
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
      return fromLeft(new Error("Wrong data"));
    };
    return tryCatch(
      () => fs.promises.mkdir(outputFolder, { recursive: true }),
      (error: unknown) =>
        genericInternalUnknownErrorHandler(
          error,
          "requestController#createOnboardingDocument | An error occurred creating documents folder.",
          "An error occurred creating documents folder."
        )
    )
      .chain(() =>
        createDocumentPerRequest(requestsCreationResponseSuccess.value).mapLeft(
          error =>
            genericInternalUnknownErrorHandler(
              error,
              "requestController#createOnboardingDocument | An error occurred during document generation.",
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
          "requestController#createOnboardingDocument | An error occurred creating documents folder.",
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
              "RequestController#createSignedDocument | An error occurred while reading unsigned document file.",
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
              "RequestController#createSignedDocument | An error occurred while signing the document.",
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
              "RequestController#createSignedDocument | An error occurred while saving signed document file.",
              "An error occurred while saving signed document file"
            )
        )
      );
  }
}

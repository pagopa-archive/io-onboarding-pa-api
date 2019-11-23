import { Request } from "express";
import { isSome, none, Option, some } from "fp-ts/lib/Option";
import * as fs from "fs";
import {
  IResponseErrorConflict,
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessJson,
  IResponseSuccessRedirectToResource,
  ResponseErrorConflict,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorInternal,
  ResponseErrorNotFound,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import { AdministrationSearchParam } from "../generated/AdministrationSearchParam";
import { AdministrationSearchResult } from "../generated/AdministrationSearchResult";
import { FiscalCode } from "../generated/FiscalCode";
import { GetOrganizationResults } from "../generated/GetOrganizationResults";
import { Organization } from "../generated/Organization";
import { OrganizationRegistrationParams } from "../generated/OrganizationRegistrationParams";
import { OrganizationRegistrationStatusEnum } from "../generated/OrganizationRegistrationStatus";
import { UserRoleEnum } from "../generated/UserRole";
import localeIt from "../locales/it";
import { Organization as OrganizationModel } from "../models/Organization";
import DocumentService from "../services/documentService";
import EmailService from "../services/emailService";
import {
  deleteOrganization,
  findPublicAdministrationsByName,
  getAllRegisteredOrganizations,
  getOrganizationFromUserEmail,
  getOrganizationInstanceFromDelegateEmail,
  registerOrganization
} from "../services/organizationService";
import { withUserFromRequest } from "../types/user";
import { log } from "../utils/logger";
import {
  IResponseDownload,
  IResponseNoContent,
  ResponseDownload,
  ResponseNoContent,
  withCatchAsInternalError,
  withValidatedOrValidationError
} from "../utils/responses";

export default class OrganizationController {
  constructor(
    private readonly documentService: DocumentService,
    private readonly emailService: EmailService
  ) {}

  public async findPublicAdministration(
    req: Request
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
              administrations: await findPublicAdministrationsByName(
                searchParam
              )
            }),
          "Internal message error"
        )
    );
  }

  public registerOrganization(
    req: Request
  ): Promise<
    // tslint:disable-next-line:max-union-size
    | IResponseErrorConflict
    | IResponseErrorForbiddenNotAuthorized
    | IResponseErrorInternal
    | IResponseErrorNotFound
    | IResponseErrorValidation
    | IResponseSuccessRedirectToResource<Organization, Organization>
  > {
    return withUserFromRequest(req, async user => {
      if (user.role !== UserRoleEnum.ORG_DELEGATE) {
        return ResponseErrorForbiddenNotAuthorized;
      }
      return withValidatedOrValidationError(
        OrganizationRegistrationParams.decode(req.body),
        async (
          organizationRegistrationParams: OrganizationRegistrationParams
        ) => {
          const maybeResponse = await this.deleteAssociatedPreDraftOrganization(
            user.email
          );
          if (maybeResponse.isSome()) {
            return maybeResponse.value;
          }
          const errorResponseOrSuccessResponse = await registerOrganization(
            organizationRegistrationParams,
            user
          );
          return errorResponseOrSuccessResponse.map(async response => {
            const organization = response.payload;
            // TODO:
            //  the documents must be stored on cloud (Azure Blob Storage).
            //  @see https://www.pivotaltracker.com/story/show/169644958
            const outputFolder = `./documents/${organization.ipa_code}`;
            try {
              await fs.promises.mkdir(outputFolder, { recursive: true });
              const arrayOfMaybeError = await Promise.all([
                this.documentService.generateDocument(
                  localeIt.organizationController.registerOrganization.contract.replace(
                    "%s",
                    `${organization.name} ${organization.fiscal_code}`
                  ),
                  `${outputFolder}/contract.pdf`
                ),
                this.documentService.generateDocument(
                  // TODO:
                  //  refactor this operation using an internationalization framework allowing params interpolation in strings.
                  //  @see https://www.pivotaltracker.com/story/show/169644146
                  localeIt.organizationController.registerOrganization.delegation
                    .replace(
                      "%legalRepresentative%",
                      `${organizationRegistrationParams.legal_representative.given_name} ${organizationRegistrationParams.legal_representative.family_name}`
                    )
                    .replace("%organizationName%", organization.name)
                    .replace(
                      "%delegate%",
                      `${user.givenName} ${user.familyName}`
                    ),
                  `${outputFolder}/mandate-${user.fiscalCode.toLowerCase()}.pdf`
                )
              ]);
              const someError = arrayOfMaybeError.find(isSome);
              if (someError) {
                log.error(someError.value);
                return ResponseErrorInternal("Internal server error");
              }
              return response;
            } catch (error) {
              log.error(error);
              return ResponseErrorInternal("Internal server error");
            }
          }).value;
        }
      );
    });
  }

  public getOrganizations(
    req: Request
  ): Promise<
    // tslint:disable-next-line:max-union-size
    | IResponseErrorValidation
    | IResponseErrorInternal
    | IResponseErrorForbiddenNotAuthorized
    | IResponseSuccessJson<GetOrganizationResults>
  > {
    return withUserFromRequest(req, async user => {
      const handleError = (error: Error) => {
        log.error(
          "An error occurred while reading from the database. %s",
          error
        );
        return ResponseErrorInternal(
          "An error occurred while reading from the database."
        );
      };
      switch (user.role) {
        case UserRoleEnum.ADMIN: // can see all the organizations
          const errorOrOrganizations = await getAllRegisteredOrganizations();
          return errorOrOrganizations.fold<
            | IResponseErrorInternal
            | IResponseSuccessJson<{ items: ReadonlyArray<Organization> }>
          >(handleError, organizations => {
            return ResponseSuccessJson({
              items: organizations
            });
          });
        case UserRoleEnum.ORG_MANAGER: // can see only his represented organization
        case UserRoleEnum.ORG_DELEGATE: // can see only his delegating organization
          const errorOrMaybeOrganization = await getOrganizationFromUserEmail(
            user.email
          );
          return errorOrMaybeOrganization.fold<
            | IResponseErrorInternal
            | IResponseSuccessJson<GetOrganizationResults>
          >(handleError, maybeOrganization =>
            maybeOrganization
              .map<
                | IResponseErrorInternal
                | IResponseSuccessJson<GetOrganizationResults>
              >(organization =>
                ResponseSuccessJson({
                  items: [organization]
                })
              )
              .getOrElse(
                ResponseErrorInternal(
                  "Could not find the organization associated to the user"
                )
              )
          );
        default:
          // can see no organization
          return ResponseErrorForbiddenNotAuthorized;
      }
    });
  }

  public getDocument(
    req: Request
  ): Promise<
    // tslint:disable-next-line:max-union-size
    | IResponseErrorValidation
    | IResponseErrorForbiddenNotAuthorized
    | IResponseErrorNotFound
    | IResponseErrorInternal
    | IResponseDownload
  > {
    return withUserFromRequest(req, async user => {
      if (user.role !== UserRoleEnum.ORG_DELEGATE) {
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

  public async sendDocuments(
    req: Request
  ): Promise<
    // tslint:disable-next-line:max-union-size
    | IResponseErrorValidation
    | IResponseErrorForbiddenNotAuthorized
    | IResponseErrorNotFound
    | IResponseErrorConflict
    | IResponseErrorInternal
    | IResponseNoContent
  > {
    return withUserFromRequest(req, async user => {
      if (user.role !== UserRoleEnum.ORG_DELEGATE) {
        return ResponseErrorForbiddenNotAuthorized;
      }
      const errorOrMaybeOrganizationInstance = await getOrganizationInstanceFromDelegateEmail(
        user.email,
        req.params.ipaCode
      );
      return errorOrMaybeOrganizationInstance.fold(
        async error => {
          log.error("An error occurred reading from db. %s", error);
          return ResponseErrorInternal("An error occurred reading from db");
        },
        async maybeOrganizationInstance => {
          if (maybeOrganizationInstance.isNone()) {
            return ResponseErrorNotFound(
              "Not found",
              "The administration is not registered"
            );
          }
          const organizationInstance = maybeOrganizationInstance.value;
          if (
            organizationInstance.registrationStatus ===
            OrganizationRegistrationStatusEnum.REGISTERED
          ) {
            return ResponseErrorConflict(
              "The required documents have already been sent and countersigned"
            );
          }
          return this.signAndSendDocuments(
            user.fiscalCode,
            organizationInstance
          );
        }
      );
    });
  }

  private async deleteAssociatedPreDraftOrganization(
    userEmail: string
  ): Promise<Option<IResponseErrorInternal | IResponseErrorConflict>> {
    const errorOrMaybeOrganizationInstance = await getOrganizationInstanceFromDelegateEmail(
      userEmail
    );
    if (errorOrMaybeOrganizationInstance.isLeft()) {
      log.error(
        "An error occurred reading data from db. %s",
        errorOrMaybeOrganizationInstance.value
      );
      return some(
        ResponseErrorInternal("An error occurred reading data from DB")
      );
    }
    const organizationInstance = errorOrMaybeOrganizationInstance.value.toNullable();
    if (organizationInstance) {
      if (
        organizationInstance.registrationStatus !==
        OrganizationRegistrationStatusEnum.PRE_DRAFT
      ) {
        return some(
          ResponseErrorConflict(
            "There is already a registered organization associated to your account"
          )
        );
      } else {
        // The organization already associated to the user
        // is still in draft or pre-draft status,
        // so its registration process must be canceled
        const maybeError = await deleteOrganization(organizationInstance);
        if (maybeError.isSome()) {
          log.error(
            `An error occurred when canceling the registration process for the organization ${organizationInstance.ipaCode}. %s`,
            maybeError.value
          );
          return some(
            ResponseErrorInternal(
              `An error occurred when canceling the previous registration process for the organization ${organizationInstance.ipaCode}`
            )
          );
        }
      }
    }
    return none;
  }

  private async signAndSendDocuments(
    delegateFiscalCode: FiscalCode,
    organizationInstance: OrganizationModel
  ): Promise<IResponseErrorInternal | IResponseNoContent> {
    // TODO:
    //  the documents must be stored on cloud (Azure Blob Storage).
    //  @see https://www.pivotaltracker.com/story/show/169644958
    const unsignedContractPath = `./documents/${organizationInstance.ipaCode}/contract.pdf`;
    const signedContractPath = `./documents/${organizationInstance.ipaCode}/signed-contract.pdf`;
    const unsignedMandatePath = `./documents/${
      organizationInstance.ipaCode
    }/mandate-${delegateFiscalCode.toLocaleLowerCase()}.pdf`;
    const signedMandatePath = `./documents/${
      organizationInstance.ipaCode
    }/signed-mandate-${delegateFiscalCode.toLocaleLowerCase()}.pdf`;

    const arrayOfMaybeError = await Promise.all([
      this.createSignedDocument(unsignedContractPath, signedContractPath),
      this.createSignedDocument(unsignedMandatePath, signedMandatePath)
    ]);
    const errorsArray = arrayOfMaybeError.filter(maybeError =>
      maybeError.isSome()
    );
    if (errorsArray.length > 0) {
      errorsArray.forEach(error =>
        log.error("An error occurred while signing documents. %s", error)
      );
      return ResponseErrorInternal("An error occurred while signing documents");
    }
    try {
      await organizationInstance.update({
        registrationStatus: OrganizationRegistrationStatusEnum.DRAFT
      });
    } catch (error) {
      log.error("An error occurred updating registration status. %s", error);
      return ResponseErrorInternal(
        "An error occurred updating registration status"
      );
    }
    try {
      await this.emailService.send({
        attachments: [
          {
            filename: "contratto.pdf",
            path: signedContractPath
          },
          {
            filename: `delega-${delegateFiscalCode.toLocaleLowerCase()}.pdf`,
            path: signedMandatePath
          }
        ],
        html:
          localeIt.organizationController.sendDocuments.registrationEmail
            .content,
        subject:
          localeIt.organizationController.sendDocuments.registrationEmail
            .subject,
        text:
          localeIt.organizationController.sendDocuments.registrationEmail
            .content,
        to: organizationInstance.pec
      });
    } catch (error) {
      log.error("An error occurred sending email. %s", error);
      return ResponseErrorInternal("An error occurred sending email");
    }
    return ResponseNoContent();
  }

  private async createSignedDocument(
    inputPath: string,
    outputPath: string
  ): Promise<Option<Error>> {
    try {
      const unsignedContentBase64 = await fs.promises.readFile(inputPath, {
        encoding: "base64"
      });
      const errorOrSignedContentBase64 = await this.documentService.signDocument(
        unsignedContentBase64
      );
      return errorOrSignedContentBase64.fold(
        async error => {
          log.error("An error occurred while signing document. %s", error);
          return some(error);
        },
        async signedContentBase64 => {
          try {
            await fs.promises.writeFile(outputPath, signedContentBase64, {
              encoding: "base64"
            });
            return none;
          } catch (error) {
            log.error(
              "An error occurred while saving signed document. %s",
              error
            );
            return some(error);
          }
        }
      );
    } catch (error) {
      log.error("An error occurred while reading unsigned document. %s", error);
      return some(error);
    }
  }
}

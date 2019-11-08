import { Request } from "express";
import { isSome } from "fp-ts/lib/Option";
import * as fs from "fs";
import {
  IResponseErrorConflict,
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessJson,
  IResponseSuccessRedirectToResource,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import { AdministrationSearchParam } from "../generated/AdministrationSearchParam";
import { AdministrationSearchResult } from "../generated/AdministrationSearchResult";
import { Organization } from "../generated/Organization";
import { OrganizationRegistrationParams } from "../generated/OrganizationRegistrationParams";
import { UserRoleEnum } from "../generated/UserRole";
import localeIt from "../locales/it";
import DocumentService from "../services/documentService";
import { findPublicAdministrationsByName, registerOrganization } from "../services/organizationService";
import { withUserFromRequest } from "../types/user";
import { log } from "../utils/logger";
import { withCatchAsInternalError, withValidatedOrValidationError } from "../utils/responses";

export default class OrganizationController {
  constructor(private readonly documentService: DocumentService) {}
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
          const errorResponseOrSuccessResponse = await registerOrganization(
            organizationRegistrationParams,
            user
          );
          return errorResponseOrSuccessResponse.map(async response => {
            const organization = response.payload;
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
                  `${outputFolder}/mandate.pdf`
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
}

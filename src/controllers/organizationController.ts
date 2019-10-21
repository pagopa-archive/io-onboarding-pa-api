import { Request } from "express";
import {
  IResponseErrorConflict,
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessJson,
  IResponseSuccessRedirectToResource,
  ResponseErrorForbiddenNotAuthorized,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import { AdministrationSearchParam } from "../generated/AdministrationSearchParam";
import { AdministrationSearchResult } from "../generated/AdministrationSearchResult";
import { Organization } from "../generated/Organization";
import { OrganizationRegistrationParams } from "../generated/OrganizationRegistrationParams";
import { UserRoleEnum } from "../generated/UserRole";
import {
  findPublicAdministrationsByName,
  registerOrganization
} from "../services/organizationService";
import { withUserFromRequest } from "../types/user";
import {
  withCatchAsInternalError,
  withValidatedOrValidationError
} from "../utils/responses";

export default class OrganizationController {
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
        (organizationRegistrationParams: OrganizationRegistrationParams) =>
          registerOrganization(organizationRegistrationParams, user)
      );
    });
  }
}

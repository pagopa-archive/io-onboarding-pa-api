import { Request } from "express";
import {
  IResponseErrorConflict,
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessRedirectToResource,
  ResponseErrorForbiddenNotAuthorized
} from "italia-ts-commons/lib/responses";
import { Organization } from "../generated/Organization";
import { OrganizationRegistrationParams } from "../generated/OrganizationRegistrationParams";
import { UserRoleEnum } from "../generated/UserRole";
import { registerOrganization } from "../services/organizationService";
import { withUserFromRequest } from "../types/user";
import { withValidatedOrValidationError } from "../utils/responses";

export default class OrganizationController {
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

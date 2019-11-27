import { AccessControl } from "accesscontrol";
import { UserRoleEnum } from "../generated/UserRole";

export const ORGANIZATION_RESOURCE = "organization";
export const UNSIGNED_DOCUMENT_RESOURCE = "unsigned-document";
export const SIGNED_DOCUMENT_RESOURCE = "signed-document";

const accessControl = new AccessControl();
accessControl
  .grant(UserRoleEnum.ORG_DELEGATE)
  .createOwn(ORGANIZATION_RESOURCE)
  .readOwn(ORGANIZATION_RESOURCE)
  .readOwn(UNSIGNED_DOCUMENT_RESOURCE)
  .createOwn(SIGNED_DOCUMENT_RESOURCE);
accessControl.grant(UserRoleEnum.ORG_MANAGER).readOwn(ORGANIZATION_RESOURCE);
accessControl.grant(UserRoleEnum.ADMIN).readAny(ORGANIZATION_RESOURCE);
accessControl.grant(UserRoleEnum.DEVELOPER);

export default accessControl;

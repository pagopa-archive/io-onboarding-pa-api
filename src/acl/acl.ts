import { AccessControl } from "accesscontrol";
import { UserRoleEnum } from "../generated/UserRole";

const accessControl = new AccessControl();
accessControl
  .grant(UserRoleEnum.ORG_DELEGATE)
  .createOwn("organization")
  .readOwn("organization")
  .readOwn("document")
  .createOwn("signed-document");
accessControl.grant(UserRoleEnum.ORG_MANAGER).readOwn("organization");
accessControl.grant(UserRoleEnum.ADMIN).readAny("organization");
accessControl.grant(UserRoleEnum.DEVELOPER);

export default accessControl;

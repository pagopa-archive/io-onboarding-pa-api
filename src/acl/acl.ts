import { AccessControl } from "accesscontrol";
import { UserRoleEnum } from "../generated/UserRole";

export enum Resource {
  ADMINISTRATION = "administration",
  DELEGATE = "delegate",
  ORGANIZATION = "organization",
  ORGANIZATION_REGISTRATION_REQUEST = "organization-registration-request",
  PROFILE = "profile",
  USER_DELEGATION_REQUEST = "user-delegation-request",
  UNSIGNED_DOCUMENT = "unsigned-document"
}

// Attribute name constants
export const EMAIL_ATTRIBUTE = "email";
export const PASSWORD_ATTRIBUTE = "password";
export const PHONE_NUMBER_ATTRIBUTE = "phoneNumber";
export const TYPE_ATTRIBUTE = "phoneNumber";
export const USER_ATTRIBUTE = "user";
export const WORK_EMAIL_ATTRIBUTE = "workEmail";

export const ALL_ATTRIBUTES = "*";

enum Action {
  CREATE_ANY = "create:any",
  CREATE_OWN = "create:own",
  READ_ANY = "read:any",
  READ_OWN = "read:own",
  UPDATE_ANY = "update:any",
  UPDATE_OWN = "update:own",
  DELETE_ANY = "delete:any",
  DELETE_OWN = "delete:own"
}

const grants = {
  [UserRoleEnum.ORG_DELEGATE]: {
    [Resource.PROFILE]: {
      [Action.READ_OWN]: [ALL_ATTRIBUTES, "!" + PASSWORD_ATTRIBUTE],
      [Action.UPDATE_OWN]: [
        WORK_EMAIL_ATTRIBUTE,
        "!" + EMAIL_ATTRIBUTE,
        "!" + PASSWORD_ATTRIBUTE,
        "!" + PHONE_NUMBER_ATTRIBUTE
      ]
    },
    [Resource.ADMINISTRATION]: {
      [Action.READ_ANY]: [ALL_ATTRIBUTES]
    },
    [Resource.DELEGATE]: {
      [Action.CREATE_OWN]: [ALL_ATTRIBUTES]
    },
    [Resource.ORGANIZATION]: {
      [Action.CREATE_OWN]: [ALL_ATTRIBUTES],
      [Action.READ_OWN]: [ALL_ATTRIBUTES]
    },
    [Resource.ORGANIZATION_REGISTRATION_REQUEST]: {
      [Action.CREATE_OWN]: [ALL_ATTRIBUTES],
      [Action.UPDATE_OWN]: [TYPE_ATTRIBUTE]
    },
    [Resource.UNSIGNED_DOCUMENT]: {
      [Action.CREATE_OWN]: [ALL_ATTRIBUTES],
      [Action.READ_OWN]: [ALL_ATTRIBUTES]
    },
    [Resource.USER_DELEGATION_REQUEST]: {
      [Action.CREATE_OWN]: [ALL_ATTRIBUTES],
      [Action.UPDATE_OWN]: [TYPE_ATTRIBUTE]
    }
  },
  [UserRoleEnum.DEVELOPER]: {
    [Resource.PROFILE]: {
      [Action.READ_OWN]: [
        ALL_ATTRIBUTES,
        "!" + PASSWORD_ATTRIBUTE,
        "!" + WORK_EMAIL_ATTRIBUTE
      ],
      [Action.UPDATE_OWN]: [
        "!" + WORK_EMAIL_ATTRIBUTE,
        EMAIL_ATTRIBUTE,
        PASSWORD_ATTRIBUTE,
        PHONE_NUMBER_ATTRIBUTE
      ]
    },
    [Resource.ADMINISTRATION]: {
      [Action.READ_ANY]: [ALL_ATTRIBUTES]
    }
  },
  [UserRoleEnum.ORG_MANAGER]: {
    [Resource.PROFILE]: {
      [Action.READ_OWN]: [
        ALL_ATTRIBUTES,
        "!" + PASSWORD_ATTRIBUTE,
        "!" + WORK_EMAIL_ATTRIBUTE
      ],
      [Action.UPDATE_OWN]: [
        PASSWORD_ATTRIBUTE,
        "!" + WORK_EMAIL_ATTRIBUTE,
        "!" + EMAIL_ATTRIBUTE,
        "!" + PHONE_NUMBER_ATTRIBUTE
      ]
    },
    [Resource.ORGANIZATION]: {
      [Action.READ_OWN]: [ALL_ATTRIBUTES],
      [Action.DELETE_OWN]: [ALL_ATTRIBUTES, USER_ATTRIBUTE]
    }
  },
  [UserRoleEnum.ADMIN]: {
    [Resource.PROFILE]: {
      [Action.READ_OWN]: [
        ALL_ATTRIBUTES,
        "!" + PASSWORD_ATTRIBUTE,
        "!" + WORK_EMAIL_ATTRIBUTE
      ],
      [Action.UPDATE_OWN]: [
        PASSWORD_ATTRIBUTE,
        "!" + WORK_EMAIL_ATTRIBUTE,
        "!" + EMAIL_ATTRIBUTE,
        "!" + PHONE_NUMBER_ATTRIBUTE
      ]
    },
    [Resource.ORGANIZATION]: {
      [Action.READ_ANY]: [ALL_ATTRIBUTES],
      [Action.DELETE_ANY]: [ALL_ATTRIBUTES]
    }
  }
};

export default new AccessControl(grants);

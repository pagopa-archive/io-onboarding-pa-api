import * as t from "io-ts";
import { EmailString, FiscalCode } from "italia-ts-commons/lib/strings";
import { UserRoleEnum } from "./user";

export const UserProfile = t.interface({
  email: EmailString,
  familyName: t.string,
  firstName: t.string,
  fiscalCode: FiscalCode,
  role: t.literal(UserRoleEnum.ORG_DELEGATE, "OrgDelegateRole"),
  workEmail: t.union([EmailString, t.null], "NullableEmailString")
});

export type UserProfile = t.TypeOf<typeof UserProfile>;

import * as t from "io-ts";
import { EmailString, FiscalCode } from "italia-ts-commons/lib/strings";
import { UserRoleEnum } from "./user";

export const UserProfile = t.intersection([
  t.interface({
    email: EmailString,
    familyName: t.string,
    firstName: t.string,
    fiscalCode: FiscalCode,
    role: t.literal(UserRoleEnum.ORG_DELEGATE, "OrgDelegateRole")
  }),
  t.partial({
    workEmail: EmailString
  })
]);

export type UserProfile = t.TypeOf<typeof UserProfile>;

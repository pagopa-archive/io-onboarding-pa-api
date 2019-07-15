import { DataTypes, Model } from "sequelize";
import sequelize from "../database/db";
import { Organization } from "./Organization";
import { User, UserRole } from "./User";

export class OrganizationUser extends Model {
  public userRole!: UserRole;
}

OrganizationUser.init(
  {
    userRole: new DataTypes.ENUM(...Object.values(UserRole))
  },
  { sequelize, modelName: "OrganizationUser", tableName: "OrganizationsUsers" }
);

Organization.belongsToMany(User, {
  foreignKey: { name: "ipaCode", field: "organizationIpaCode" },
  otherKey: { name: "fiscalCode", field: "userFiscalCode" },
  through: OrganizationUser
});

User.belongsToMany(Organization, {
  foreignKey: { name: "fiscalCode", field: "userFiscalCode" },
  otherKey: { name: "ipaCode", field: "organizationIpaCode" },
  through: OrganizationUser
});

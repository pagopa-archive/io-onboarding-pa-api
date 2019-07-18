import { DataTypes, Model } from "sequelize";
import sequelize from "../database/db";
import { UserRole } from "./User";

export class OrganizationUser extends Model {
  public userRole!: UserRole;
}

export function init(): void {
  OrganizationUser.init(
    {
      userRole: new DataTypes.ENUM(...Object.values(UserRole))
    },
    {
      modelName: "OrganizationUser",
      sequelize,
      tableName: "OrganizationsUsers"
    }
  );
}

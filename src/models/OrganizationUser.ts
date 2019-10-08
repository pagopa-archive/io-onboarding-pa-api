import { DataTypes, Model } from "sequelize";
import sequelize from "../database/db";
import { UserRoleEnum } from "../generated/UserRole";

export class OrganizationUser extends Model {
  public userRole!: UserRoleEnum;
}

export function init(): void {
  OrganizationUser.init(
    {
      userRole: new DataTypes.ENUM(...Object.values(UserRoleEnum))
    },
    {
      modelName: "OrganizationUser",
      sequelize,
      tableName: "OrganizationsUsers"
    }
  );
}

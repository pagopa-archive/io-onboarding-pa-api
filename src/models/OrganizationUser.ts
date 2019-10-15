import { DataTypes, Model } from "sequelize";
import sequelize from "../database/db";
import { UserRoleEnum } from "../generated/UserRole";

export class OrganizationUser extends Model {
  public userRole!: UserRoleEnum;
}

export function init(): void {
  OrganizationUser.init(
    {
      createdAt: {
        allowNull: false,
        type: new DataTypes.DATE()
      },
      deletedAt: {
        allowNull: true,
        type: new DataTypes.DATE()
      },
      organizationIpaCode: {
        allowNull: false,
        primaryKey: true,
        type: new DataTypes.STRING()
      },
      updatedAt: {
        allowNull: false,
        type: new DataTypes.DATE()
      },
      userEmail: {
        allowNull: false,
        primaryKey: true,
        type: new DataTypes.STRING()
      },
      userRole: {
        allowNull: false,
        type: new DataTypes.ENUM(...Object.values(UserRoleEnum))
      }
    },
    {
      modelName: "OrganizationUser",
      paranoid: true,
      sequelize,
      tableName: "OrganizationsUsers",
      timestamps: true
    }
  );
}

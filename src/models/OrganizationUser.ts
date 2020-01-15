import { DataTypes, Model } from "sequelize";
import sequelize from "../database/db";

export class OrganizationUser extends Model {}

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

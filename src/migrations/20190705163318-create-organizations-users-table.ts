import { DataTypes, QueryInterface } from "sequelize";
import { UserRoleEnum } from "../generated/UserRole";

export function up(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.createTable("OrganizationsUsers", {
    createdAt: {
      allowNull: false,
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
    userFiscalCode: {
      allowNull: false,
      primaryKey: true,
      type: new DataTypes.STRING()
    },
    userRole: {
      allowNull: false,
      type: new DataTypes.ENUM(...Object.values(UserRoleEnum))
    }
  });
}

export function down(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.dropTable("OrganizationsUsers");
}

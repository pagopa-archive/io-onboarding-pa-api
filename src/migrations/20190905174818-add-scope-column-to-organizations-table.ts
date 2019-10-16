import { DataTypes, QueryInterface } from "sequelize";
import { OrganizationScopeEnum } from "../generated/OrganizationScope";

export function up(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.addColumn("Organizations", "scope", {
    allowNull: false,
    type: new DataTypes.ENUM(...Object.values(OrganizationScopeEnum))
  });
}

export function down(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.removeColumn("Organizations", "scope");
}

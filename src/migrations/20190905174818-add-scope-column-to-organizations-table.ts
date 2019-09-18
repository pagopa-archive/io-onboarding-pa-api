import { DataTypes, QueryInterface } from "sequelize";
import { OrganizationScope } from "../models/Organization";

export function up(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.addColumn("Organizations", "scope", {
    allowNull: false,
    type: new DataTypes.ENUM(...Object.values(OrganizationScope))
  });
}

export function down(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.removeColumn("Organizations", "scope");
}

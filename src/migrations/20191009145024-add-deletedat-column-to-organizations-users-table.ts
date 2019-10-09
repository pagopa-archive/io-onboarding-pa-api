import { DataTypes, QueryInterface } from "sequelize";

export function up(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.addColumn("OrganizationsUsers", "deletedAt", {
    allowNull: true,
    type: new DataTypes.STRING()
  });
}

export function down(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.removeColumn("OrganizationsUsers", "deletedAt");
}

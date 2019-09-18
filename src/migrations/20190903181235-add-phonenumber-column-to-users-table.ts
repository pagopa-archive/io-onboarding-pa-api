import { DataTypes, QueryInterface } from "sequelize";

export function up(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.addColumn("Users", "phoneNumber", {
    allowNull: true,
    type: new DataTypes.STRING()
  });
}

export function down(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.removeColumn("Users", "phoneNumber");
}

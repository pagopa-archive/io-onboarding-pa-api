import { QueryInterface } from "sequelize";

export function up(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.renameColumn("Users", "firstName", "givenName");
}

export function down(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.renameColumn("Users", "givenName", "firstName");
}

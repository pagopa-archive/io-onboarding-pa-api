import { DataTypes, QueryInterface } from "sequelize";
import { UserRoleEnum } from "../generated/UserRole";

export function up(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.addColumn("Users", "role", {
    allowNull: false,
    defaultValue: UserRoleEnum.ORG_DELEGATE,
    type: new DataTypes.ENUM(),
    values: [...Object.values(UserRoleEnum)]
  });
}

export function down(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.removeColumn("Users", "role");
}

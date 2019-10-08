import { DataTypes, QueryInterface } from "sequelize";
import { UserRoleEnum } from "../generated/UserRole";

export function up(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.sequelize.transaction(t =>
    queryInterface
      .changeColumn(
        "OrganizationsUsers",
        "userRole",
        {
          allowNull: false,
          type: new DataTypes.STRING()
        },
        { transaction: t }
      )
      .then(() =>
        queryInterface.sequelize.query(
          `DROP TYPE "enum_OrganizationsUsers_userRole"`,
          {
            transaction: t
          }
        )
      )
      .then(() =>
        queryInterface.changeColumn(
          "OrganizationsUsers",
          "userRole",
          {
            allowNull: false,
            type: new DataTypes.ENUM(),
            values: [...Object.values(UserRoleEnum)]
          },
          { transaction: t }
        )
      )
  );
}

export function down(_: QueryInterface): Promise<void> {
  return Promise.resolve();
}

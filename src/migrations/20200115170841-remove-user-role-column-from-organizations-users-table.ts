import { DataTypes, QueryInterface } from "sequelize";

export function up(queryInterface: QueryInterface): Promise<unknown> {
  return queryInterface.sequelize.transaction(transaction =>
    queryInterface
      .removeColumn("OrganizationsUsers", "userRole", {
        transaction
      })
      .then(() =>
        queryInterface.sequelize.query(
          `DROP TYPE "enum_OrganizationsUsers_userRole"`,
          {
            transaction
          }
        )
      )
  );
}

export function down(queryInterface: QueryInterface): Promise<unknown> {
  return queryInterface.sequelize.transaction(transaction =>
    queryInterface
      .addColumn("OrganizationsUsers", "userRole", {
        allowNull: false,
        defaultValue: "PRE_DRAFT",
        type: new DataTypes.ENUM(),
        values: ["ORG_DELEGATE", "ORG_MANAGER", "DEVELOPER", "ADMIN"]
      })
      .then(() =>
        // change the values for the Organizations.legalRepresentativeEmail column in order to keep the referential integrity with the Users table
        queryInterface.sequelize.query(
          `UPDATE "OrganizationsUsers" SET "userRole" = (SELECT role FROM "Users" WHERE "Users"."email" = "OrganizationsUsers"."userEmail")`,
          {
            transaction
          }
        )
      )
  );
}

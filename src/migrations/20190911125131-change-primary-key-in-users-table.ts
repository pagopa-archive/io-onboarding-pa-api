import { DataTypes, QueryInterface } from "sequelize";

export function up(queryInterface: QueryInterface): Promise<unknown> {
  return queryInterface.sequelize.transaction(t =>
    // remove PK constraint from Users.fiscalCode column
    queryInterface.sequelize
      .query(`ALTER TABLE "Users" DROP CONSTRAINT "Users_pkey" CASCADE`, {
        transaction: t
      })
      .then(() =>
        // add PK constraint to Users.email column
        queryInterface
          .addConstraint("Users", ["email"], {
            name: "Users_pkey",
            transaction: t,
            type: "primary key"
          })
          // -------------------------------
          // Update Organizations table
          // -------------------------------
          .then(() =>
            // rename Organizations.legalRepresentativeFiscalCode column into Organizations.legalRepresentativeEmail
            queryInterface.renameColumn(
              "Organizations",
              "legalRepresentativeFiscalCode",
              "legalRepresentativeEmail",
              { transaction: t }
            )
          )
          .then(() =>
            // change the values for the Organizations.legalRepresentativeEmail column in order to keep the referential integrity with the Users table
            queryInterface.sequelize.query(
              `UPDATE "Organizations" SET "legalRepresentativeEmail" = (SELECT email FROM "Users" WHERE "Users"."fiscalCode" = "Organizations"."legalRepresentativeEmail")`,
              {
                transaction: t
              }
            )
          )
          .then(() =>
            // set FK constraint on Organizations.legalRepresentativeEmail
            queryInterface.changeColumn(
              "Organizations",
              "legalRepresentativeEmail",
              {
                references: {
                  key: "email",
                  model: "Users"
                },
                type: new DataTypes.STRING()
              },
              { transaction: t }
            )
          )
          // -------------------------------
          // Update OrganizationsUsers table
          // -------------------------------
          .then(() =>
            // rename OrganizationsUsers.userFiscalCode column into OrganizationsUsers.userEmail
            queryInterface.renameColumn(
              "OrganizationsUsers",
              "userFiscalCode",
              "userEmail",
              { transaction: t }
            )
          )
          .then(() =>
            // change the values for the OrganizationsUser.userEmail column in order to keep the referential integrity with the Users table
            queryInterface.sequelize.query(
              `UPDATE "OrganizationsUsers" SET "userEmail" = (SELECT email FROM "Users" WHERE "Users"."fiscalCode" = "OrganizationsUsers"."userEmail")`,
              {
                transaction: t
              }
            )
          )
          .then(() =>
            // set FK constraint on OrganizationsUser.userEmail
            queryInterface.changeColumn(
              "OrganizationsUsers",
              "userEmail",
              {
                references: {
                  key: "email",
                  model: "Users"
                },
                type: new DataTypes.STRING()
              },
              { transaction: t }
            )
          )
          // -------------------------------
          // Update Sessions table
          // -------------------------------
          .then(() =>
            // rename Sessions.userFiscalCode column into Sessions.userEmail
            queryInterface.renameColumn(
              "Sessions",
              "userFiscalCode",
              "userEmail",
              { transaction: t }
            )
          )
          .then(() =>
            // change the values for the Sessions.userEmail column in order to keep the referential integrity with the Users table
            queryInterface.sequelize.query(
              `UPDATE "Sessions" SET "userEmail" = (SELECT email FROM "Users" WHERE "Users"."fiscalCode" = "Sessions"."userEmail")`,
              { transaction: t }
            )
          )
          .then(() =>
            // set FK constraint on Sessions.userEmail
            queryInterface.changeColumn(
              "Sessions",
              "userEmail",
              {
                references: {
                  key: "email",
                  model: "Users"
                },
                type: new DataTypes.STRING()
              },
              { transaction: t }
            )
          )
      )
  );
}

export function down(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.sequelize.transaction(t =>
    // remove PK constraint from Users.email column
    queryInterface.sequelize
      .query(`ALTER TABLE "Users" DROP CONSTRAINT "Users_pkey" CASCADE`, {
        transaction: t
      })
      .then(() =>
        // add PK constraint to Users.fiscalCode column
        queryInterface.addConstraint("Users", ["fiscalCode"], {
          name: "Users_pkey",
          transaction: t,
          type: "primary key"
        })
      )
      // -------------------------------
      // Update Organizations table
      // -------------------------------
      .then(() =>
        // rename Organizations.legalRepresentativeEmail column into Organizations.legalRepresentativeFiscalCode
        queryInterface.renameColumn(
          "Organizations",
          "legalRepresentativeEmail",
          "legalRepresentativeFiscalCode",
          { transaction: t }
        )
      )
      .then(() =>
        // change the values for the Organizations.legalRepresentativeFiscalCode column in order to keep the referential integrity with the Users table
        queryInterface.sequelize.query(
          `UPDATE "Organizations" SET "legalRepresentativeFiscalCode" = (SELECT fiscalCode FROM "Users" WHERE "Users"."email" = "Organizations"."legalRepresentativeFiscalCode")`,
          {
            transaction: t
          }
        )
      )
      .then(() =>
        // set FK constraint on Organizations.legalRepresentativeEmail
        queryInterface.changeColumn(
          "Organizations",
          "legalRepresentativeFiscalCode",
          {
            references: {
              key: "fiscalCode",
              model: "Users"
            },
            type: new DataTypes.STRING()
          },
          { transaction: t }
        )
      )
      // -------------------------------
      // Update OrganizationsUsers table
      // -------------------------------
      .then(() =>
        // rename OrganizationsUsers.userEmail column into OrganizationsUsers.userFiscalCode
        queryInterface.renameColumn(
          "OrganizationsUsers",
          "userEmail",
          "userFiscalCode",
          { transaction: t }
        )
      )
      .then(() =>
        // change the values for the OrganizationsUser.userFiscalCode column in order to keep the referential integrity with the Users table
        queryInterface.sequelize.query(
          `UPDATE "OrganizationsUsers" SET "userFiscalCode" = (SELECT fiscalCode FROM "Users" WHERE "Users"."email" = "OrganizationsUsers"."userFiscalCode")`,
          {
            transaction: t
          }
        )
      )
      .then(() =>
        // set FK constraint on OrganizationsUser.userEmail
        queryInterface.changeColumn(
          "OrganizationsUsers",
          "userFiscalCode",
          {
            references: {
              key: "fiscalCode",
              model: "Users"
            },
            type: new DataTypes.STRING()
          },
          { transaction: t }
        )
      )

      // -------------------------------
      // Update Sessions table
      // -------------------------------
      .then(() =>
        // rename Sessions.userEmail column into Sessions.userFiscalCode
        queryInterface.renameColumn("Sessions", "userEmail", "userFiscalCode", {
          transaction: t
        })
      )
      .then(() =>
        // change the values for the Sessions.userEmail column in order to keep the referential integrity with the Users table
        queryInterface.sequelize.query(
          `UPDATE "Sessions" SET "userFiscalCode" = (SELECT fiscalCode FROM "Users" WHERE "Users"."email" = "Sessions"."userFiscalCode")`,
          { transaction: t }
        )
      )
      .then(() =>
        // set FK constraint on Sessions.userEmail
        queryInterface.changeColumn(
          "Sessions",
          "userFiscalCode",
          {
            references: {
              key: "fiscalCode",
              model: "Users"
            },
            type: new DataTypes.STRING()
          },
          { transaction: t }
        )
      )
  );
}

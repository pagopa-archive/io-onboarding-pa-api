import { DataTypes, QueryInterface } from "sequelize";
import { OrganizationScopeEnum } from "../generated/OrganizationScope";
import { RequestStatusEnum } from "../generated/RequestStatus";
import { UserRoleEnum } from "../generated/UserRole";
import { RequestType } from "../models/Request";

export function up(queryInterface: QueryInterface): Promise<unknown> {
  return queryInterface.sequelize.transaction(transaction => {
    return queryInterface
      .createTable(
        "Requests",
        {
          createdAt: {
            allowNull: false,
            type: new DataTypes.DATE()
          },
          deletedAt: {
            allowNull: true,
            type: new DataTypes.DATE()
          },
          id: {
            autoIncrement: true,
            primaryKey: true,
            type: new DataTypes.INTEGER()
          },
          legalRepresentativeFamilyName: {
            allowNull: true,
            type: new DataTypes.STRING()
          },
          legalRepresentativeFiscalCode: {
            allowNull: true,
            type: new DataTypes.STRING()
          },
          legalRepresentativeGivenName: {
            allowNull: true,
            type: new DataTypes.STRING()
          },
          legalRepresentativePhoneNumber: {
            allowNull: true,
            type: new DataTypes.STRING()
          },
          organizationFiscalCode: {
            allowNull: true,
            type: new DataTypes.STRING()
          },
          organizationIpaCode: {
            allowNull: true,
            type: new DataTypes.STRING()
          },
          organizationName: {
            allowNull: true,
            type: new DataTypes.STRING()
          },
          organizationPec: {
            allowNull: true,
            type: new DataTypes.STRING()
          },
          organizationScope: {
            allowNull: true,
            type: new DataTypes.ENUM(...Object.values(OrganizationScopeEnum))
          },
          status: {
            allowNull: false,
            defaultValue: RequestStatusEnum.CREATED,
            type: new DataTypes.ENUM(...Object.values(RequestStatusEnum))
          },
          type: {
            allowNull: false,
            type: new DataTypes.ENUM(...Object.values(RequestType))
          },
          updatedAt: {
            allowNull: false,
            type: new DataTypes.DATE()
          },
          userEmail: {
            allowNull: false,
            references: {
              key: "email",
              model: "Users"
            },
            type: new DataTypes.STRING()
          }
        },
        { transaction }
      )
      .then(() =>
        queryInterface.bulkDelete("OrganizationsUsers", {}, { transaction })
      )
      .then(() =>
        queryInterface.bulkDelete("Organizations", {}, { transaction })
      )
      .then(() =>
        queryInterface.bulkDelete(
          "Users",
          { role: UserRoleEnum.ORG_MANAGER },
          { transaction }
        )
      )
      .then(() =>
        queryInterface.removeColumn("Organizations", "registrationStatus", {
          transaction
        })
      )
      .then(() =>
        queryInterface.sequelize.query(
          `DROP TYPE "enum_Organizations_registrationStatus"`,
          {
            transaction
          }
        )
      );
  });
}

export function down(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.sequelize.transaction(transaction =>
    queryInterface.dropTable("Requests").then(() =>
      queryInterface.addColumn(
        "Organizations",
        "registrationStatus",
        {
          allowNull: false,
          defaultValue: "PRE_DRAFT",
          type: new DataTypes.ENUM(),
          values: ["PRE_DRAFT", "DRAFT", "REGISTERED"]
        },
        { transaction }
      )
    )
  );
}

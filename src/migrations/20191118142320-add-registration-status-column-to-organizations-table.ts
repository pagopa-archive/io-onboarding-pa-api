import { DataTypes, QueryInterface } from "sequelize";
import { OrganizationRegistrationStatusEnum } from "../generated/OrganizationRegistrationStatus";

export function up(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.addColumn("Organizations", "registrationStatus", {
    allowNull: false,
    defaultValue: OrganizationRegistrationStatusEnum.PRE_DRAFT,
    type: new DataTypes.ENUM(),
    values: [...Object.values(OrganizationRegistrationStatusEnum)]
  });
}

export function down(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.removeColumn("registrationStatus", "scope");
}

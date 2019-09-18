import { DataTypes, QueryInterface } from "sequelize";

export function up(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.addColumn(
    "Organizations",
    "legalRepresentativeFiscalCode",
    {
      references: {
        key: "fiscalCode",
        model: "Users"
      },
      type: new DataTypes.STRING()
    }
  );
}

export function down(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.removeColumn(
    "Organizations",
    "legalRepresentativeFiscalCode"
  );
}

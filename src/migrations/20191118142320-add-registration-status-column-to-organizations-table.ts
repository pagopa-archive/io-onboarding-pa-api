import { DataTypes, QueryInterface } from "sequelize";

export function up(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.addColumn("Organizations", "registrationStatus", {
    allowNull: false,
    defaultValue: "PRE_DRAFT",
    type: new DataTypes.ENUM(),
    values: ["PRE_DRAFT", "DRAFT", "REGISTERED"]
  });
}

export function down(queryInterface: QueryInterface): Promise<unknown> {
  return queryInterface.sequelize.transaction(transaction =>
    queryInterface
      .removeColumn("Organizations", "registrationStatus", {
        transaction
      })
      .then(() =>
        queryInterface.sequelize.query(
          `DROP TYPE "enum_Organizations_registrationStatus"`,
          {
            transaction
          }
        )
      )
  );
}

import { DataTypes, NOW, QueryInterface } from "sequelize";

export default {
  up: (queryInterface: QueryInterface): Promise<void> => {
    return queryInterface.createTable("PA", {
      createdAt: {
        allowNull: false,
        type: new DataTypes.DATE()
      },
      deletedAt: new DataTypes.DATE(),
      description: {
        allowNull: false,
        type: new DataTypes.STRING()
      },
      ipaCode: {
        allowNull: false,
        field: "ipa_code",
        primaryKey: true,
        type: new DataTypes.STRING()
      },
      name: {
        allowNull: false,
        type: new DataTypes.STRING()
      },
      pec: {
        allowNull: false,
        field: "PEC",
        type: new DataTypes.STRING()
      },
      updatedAt: new DataTypes.DATE()
    });
  },

  down: (queryInterface: QueryInterface): Promise<void> => {
    return queryInterface.dropTable("PA");
  }
};

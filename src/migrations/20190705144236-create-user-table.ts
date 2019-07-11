import { DataTypes, QueryInterface } from "sequelize";

export default {
  up: (queryInterface: QueryInterface): Promise<void> => {
    return queryInterface.createTable("User", {
      createdAt: {
        allowNull: false,
        type: new DataTypes.DATE()
      },
      deletedAt: new DataTypes.DATE(),
      fc: {
        allowNull: false,
        field: "FC",
        primaryKey: true,
        type: new DataTypes.STRING()
      },
      name: {
        allowNull: false,
        type: new DataTypes.STRING()
      },
      surname: {
        allowNull: false,
        type: new DataTypes.STRING()
      },
      updatedAt: new DataTypes.DATE()
    });
  },

  down: (queryInterface: QueryInterface): Promise<void> => {
    return queryInterface.dropTable("User");
  }
};

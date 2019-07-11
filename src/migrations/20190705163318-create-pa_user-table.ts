import { DataTypes, QueryInterface } from "sequelize";
import { UserType } from "../models/User";

export default {
  up: (queryInterface: QueryInterface): Promise<void> => {
    return queryInterface.createTable("PA_User", {
      createdAt: {
        allowNull: false,
        type: new DataTypes.DATE()
      },
      fc: {
        allowNull: false,
        field: "FC",
        primaryKey: true,
        type: new DataTypes.STRING()
      },
      ipaCode: {
        allowNull: false,
        field: "ipa_code",
        primaryKey: true,
        type: new DataTypes.STRING()
      },
      type: {
        allowNull: false,
        type: new DataTypes.ENUM(...Object.values(UserType))
      },
      updatedAt: {
        allowNull: false,
        type: new DataTypes.DATE()
      }
    });
  },

  down: (queryInterface: QueryInterface): Promise<void> => {
    return queryInterface.dropTable("PA_User");
  }
};

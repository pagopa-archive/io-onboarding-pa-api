import { DataTypes, QueryInterface } from "sequelize";

export function up(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.createTable("Users", {
    createdAt: {
      allowNull: false,
      type: new DataTypes.DATE()
    },
    deletedAt: {
      /**
       * Deletion date of the entry.
       * This field will be set instead of deleting the entry from the database.
       * @see: https://docs.sequelizejs.com/manual/models-definition.html#configuration
       */
      allowNull: true,
      type: new DataTypes.DATE()
    },
    familyName: {
      /**
       * Family name of the user
       */
      allowNull: false,
      type: new DataTypes.STRING()
    },
    firstName: {
      /**
       * First name of the user
       */
      allowNull: false,
      type: new DataTypes.STRING()
    },
    fiscalCode: {
      /**
       *  Fiscal code of the user
       */
      allowNull: false,
      primaryKey: true,
      type: new DataTypes.STRING()
    },
    updatedAt: new DataTypes.DATE()
  });
}

export function down(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.dropTable("Users");
}

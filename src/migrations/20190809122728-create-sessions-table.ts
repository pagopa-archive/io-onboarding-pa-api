import { DataTypes, QueryInterface } from "sequelize";

export function up(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.createTable("Sessions", {
    createdAt: {
      /**
       * Creation date of the entry.
       * It represents the time when the user logs in.
       */
      allowNull: false,
      type: new DataTypes.DATE()
    },
    deletedAt: {
      /**
       * Deletion date of the entry.
       * It represents the moment since the token is not valid anymore
       * because the user performed a logout.
       * This field will be set instead of deleting the entry from the database,
       * @see: https://docs.sequelizejs.com/manual/models-definition.html#configuration
       */
      allowNull: true,
      type: new DataTypes.DATE()
    },
    expirationTime: {
      /**
       * Session expiration time.
       * It represents the moment since the token is not valid anymore
       * regardless of weather the user has already logged out or not.
       */
      allowNull: false,
      type: new DataTypes.DATE()
    },
    token: {
      /**
       * Token associated to the session
       */
      allowNull: false,
      primaryKey: true,
      type: new DataTypes.STRING()
    },
    updatedAt: new DataTypes.DATE(),
    userFiscalCode: {
      references: {
        key: "fiscalCode",
        model: "Users"
      },
      type: new DataTypes.STRING()
    }
  });
}

export function down(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.dropTable("Sessions");
}

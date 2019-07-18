import { DataTypes, QueryInterface } from "sequelize";

export function up(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.createTable("Organizations", {
    createdAt: {
      /**
       *  Creation date of the entry
       */
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
    ipaCode: {
      /**
       * The code of the organization from IPA (Indice della Pubblica Amministrazione)
       */
      allowNull: false,
      primaryKey: true,
      type: new DataTypes.STRING()
    },
    name: {
      /**
       * The full name of the organization, e.g. "Comune di Milano"
       */
      allowNull: false,
      type: new DataTypes.STRING()
    },
    pec: {
      /**
       * The certified electronic mail address of the organization
       */
      allowNull: false,
      type: new DataTypes.STRING()
    },
    updatedAt: {
      /**
       *  Last update date of the entry
       */
      allowNull: false,
      type: new DataTypes.DATE()
    }
  });
}

export function down(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.dropTable("Organizations");
}

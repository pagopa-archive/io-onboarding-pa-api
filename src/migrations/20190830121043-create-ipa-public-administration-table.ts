import { DataTypes, QueryInterface } from "sequelize";

export function up(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.createTable("IpaPublicAdministrations", {
    Cf: {
      allowNull: false,
      type: new DataTypes.STRING()
    },
    cf_validato: {
      allowNull: false,
      type: new DataTypes.STRING()
    },
    cod_amm: {
      allowNull: false,
      primaryKey: true,
      type: new DataTypes.STRING()
    },
    cogn_resp: {
      allowNull: false,
      type: new DataTypes.STRING()
    },
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
    des_amm: {
      allowNull: false,
      type: new DataTypes.STRING()
    },
    mail1: {
      allowNull: false,
      type: new DataTypes.STRING()
    },
    mail2: {
      allowNull: false,
      type: new DataTypes.STRING()
    },
    mail3: {
      allowNull: false,
      type: new DataTypes.STRING()
    },
    mail4: {
      allowNull: false,
      type: new DataTypes.STRING()
    },
    mail5: {
      allowNull: false,
      type: new DataTypes.STRING()
    },
    nome_resp: {
      allowNull: false,
      type: new DataTypes.STRING()
    },
    tipo_mail1: {
      allowNull: false,
      type: new DataTypes.STRING()
    },
    tipo_mail2: {
      allowNull: false,
      type: new DataTypes.STRING()
    },
    tipo_mail3: {
      allowNull: false,
      type: new DataTypes.STRING()
    },
    tipo_mail4: {
      allowNull: false,
      type: new DataTypes.STRING()
    },
    tipo_mail5: {
      allowNull: false,
      type: new DataTypes.STRING()
    },
    titolo_resp: {
      allowNull: false,
      type: new DataTypes.STRING()
    },
    updatedAt: {
      allowNull: false,
      type: new DataTypes.DATE()
    }
  });
}

export function down(queryInterface: QueryInterface): Promise<void> {
  return queryInterface.dropTable("IpaPublicAdministrations");
}

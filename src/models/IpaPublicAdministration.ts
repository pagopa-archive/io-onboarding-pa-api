// tslint:disable:variable-name
import { DataTypes, Model } from "sequelize";
import sequelize from "../database/db";

export class IpaPublicAdministration extends Model {
  public cod_amm!: string;
  public des_amm!: string;
  public nome_resp!: string;
  public cogn_resp!: string;
  public titolo_resp!: string;
  public cf_validato!: string;
  public Cf!: string;
  public mail1!: string;
  public tipo_mail1!: string;
  public mail2!: string;
  public tipo_mail2!: string;
  public mail3!: string;
  public tipo_mail3!: string;
  public mail4!: string;
  public tipo_mail4!: string;
  public mail5!: string;
  public tipo_mail5!: string;
}

export function init(): void {
  IpaPublicAdministration.init(
    {
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
      }
    },
    {
      modelName: "IpaPublicAdministration",
      paranoid: true,
      sequelize,
      tableName: "IpaPublicAdministrations",
      timestamps: true
    }
  );
}

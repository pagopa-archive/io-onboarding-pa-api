import {
  BelongsToManyAddAssociationMixin,
  DataTypes,
  Model,
  NOW
} from "sequelize";
import sequelize from "../database/db";
import { User } from "./User";

export class PublicAdministration extends Model {
  public ipaCode!: string; // PK
  public name!: string;
  public pec!: string;
  public description!: string;
  public readonly registrationDate!: Date;

  public addUser!: BelongsToManyAddAssociationMixin<User, string>;

  public readonly users?: ReadonlyArray<User>;
}

PublicAdministration.init(
  {
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
    registrationDate: {
      allowNull: false,
      defaultValue: NOW,
      type: new DataTypes.DATE()
    }
  },
  {
    modelName: "PublicAdministration",
    paranoid: true,
    sequelize,
    tableName: "PA",
    timestamps: true
  }
);

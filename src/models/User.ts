import { DataTypes, Model } from "sequelize";
import sequelize from "../database/db";

export enum UserType {
  DE = "DE", // Public Administration delegate
  RLE = "RLE" // Public Administration manager
}

export class User extends Model {
  public fc!: string; // PK
  public name!: string;
  public surname!: string;
}

User.init(
  {
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
    }
  },
  {
    modelName: "User",
    paranoid: true,
    sequelize,
    tableName: "User",
    timestamps: true
  }
);

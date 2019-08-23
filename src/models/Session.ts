import { DataTypes, Model } from "sequelize";
import sequelize from "../database/db";
import { User } from "./User";

export class Session extends Model {
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly expirationTime!: Date;
  public readonly token!: string;
  public readonly userFiscalCode!: string;
}

export function init(): void {
  Session.init(
    {
      expirationTime: {
        allowNull: false,
        type: new DataTypes.DATE()
      },
      token: {
        allowNull: false,
        primaryKey: true,
        type: new DataTypes.STRING()
      },
      userFiscalCode: {
        references: {
          key: "fiscalCode",
          model: "User"
        },
        type: new DataTypes.STRING()
      }
    },
    {
      modelName: "Session",
      paranoid: true,
      sequelize,
      tableName: "Sessions",
      timestamps: true
    }
  );
}

export function createAssociations(): void {
  Session.belongsTo(User, {
    foreignKey: { name: "fiscalCode", field: "userFiscalCode" }
  });
}

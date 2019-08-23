import { DataTypes, HasManyCreateAssociationMixin, Model } from "sequelize";
import sequelize from "../database/db";
import { Organization } from "./Organization";
import { OrganizationUser } from "./OrganizationUser";
import { Session } from "./Session";

export enum UserRole {
  ORG_DELEGATE = "ORG_DELEGATE", // Organization delegate
  ORG_MANAGER = "ORG_MANAGER" // Organization manager
}

export class User extends Model {
  public email!: string;
  public fiscalCode!: string; // PK
  public firstName!: string;
  public familyName!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public readonly session?: Session;
  public readonly sessions?: ReadonlyArray<Session>;
  public createSession!: HasManyCreateAssociationMixin<Session>;
}

export function init(): void {
  User.init(
    {
      email: {
        allowNull: false,
        type: new DataTypes.STRING()
      },
      familyName: {
        allowNull: false,
        type: new DataTypes.STRING()
      },
      firstName: {
        allowNull: false,
        type: new DataTypes.STRING()
      },
      fiscalCode: {
        allowNull: false,
        primaryKey: true,
        type: new DataTypes.STRING()
      }
    },
    {
      modelName: "User",
      paranoid: true,
      sequelize,
      tableName: "Users",
      timestamps: true
    }
  );
}

export function createAssociations(): void {
  User.belongsToMany(Organization, {
    foreignKey: { name: "fiscalCode", field: "userFiscalCode" },
    otherKey: { name: "ipaCode", field: "organizationIpaCode" },
    through: OrganizationUser
  });
  User.hasMany(Session, {
    foreignKey: { name: "fiscalCode", field: "userFiscalCode" }
  });
}

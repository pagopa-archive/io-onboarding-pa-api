import {
  BelongsToManyAddAssociationMixin,
  BelongsToSetAssociationMixin,
  DataTypes,
  Model
} from "sequelize";
import sequelize from "../database/db";
import { OrganizationScope } from "../generated/OrganizationScope";
import { OrganizationUser } from "./OrganizationUser";
import { User } from "./User";

export class Organization extends Model {
  public fiscalCode!: string;
  public ipaCode!: string; // PK
  public name!: string;
  public pec!: string;
  public scope!: OrganizationScope;
  public readonly createdAt!: Date;
  public readonly deletedAt!: Date;
  public readonly updatedAt!: Date;

  public addUser!: BelongsToManyAddAssociationMixin<User, string>;
  public setLegalRepresentative!: BelongsToSetAssociationMixin<User, string>;

  public readonly legalRepresentative!: User;
  public readonly users?: ReadonlyArray<User>;
}

export function init(): void {
  Organization.init(
    {
      fiscalCode: {
        allowNull: false,
        type: new DataTypes.STRING()
      },
      ipaCode: {
        allowNull: false,
        primaryKey: true,
        type: new DataTypes.STRING()
      },
      legalRepresentativeEmail: {
        allowNull: true,
        type: new DataTypes.STRING()
      },
      name: {
        allowNull: false,
        type: new DataTypes.STRING()
      },
      pec: {
        allowNull: false,
        type: new DataTypes.STRING()
      },
      scope: {
        allowNull: false,
        type: new DataTypes.ENUM(...Object.values(OrganizationScope))
      }
    },
    {
      modelName: "Organization",
      paranoid: true,
      sequelize,
      tableName: "Organizations",
      timestamps: true
    }
  );
}

export function createAssociations(): void {
  Organization.belongsToMany(User, {
    as: "users",
    foreignKey: { name: "ipaCode", field: "organizationIpaCode" },
    otherKey: { name: "email", field: "userEmail" },
    through: OrganizationUser
  });
  Organization.belongsTo(User, {
    as: "legalRepresentative",
    foreignKey: {
      field: "legalRepresentativeEmail",
      name: "legalRepresentativeEmail"
    }
  });
}

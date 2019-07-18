import { BelongsToManyAddAssociationMixin, DataTypes, Model } from "sequelize";
import sequelize from "../database/db";
import { OrganizationUser } from "./OrganizationUser";
import { User } from "./User";

export class Organization extends Model {
  public ipaCode!: string; // PK
  public name!: string;
  public pec!: string;
  public description!: string;
  public readonly createdAt!: Date;
  public readonly deletedAt!: Date;
  public readonly updatedAt!: Date;

  public addUser!: BelongsToManyAddAssociationMixin<User, string>;

  public readonly users?: ReadonlyArray<User>;
}

export function init(): void {
  Organization.init(
    {
      ipaCode: {
        allowNull: false,
        primaryKey: true,
        type: new DataTypes.STRING()
      },
      name: {
        allowNull: false,
        type: new DataTypes.STRING()
      },
      pec: {
        allowNull: false,
        type: new DataTypes.STRING()
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
    foreignKey: { name: "ipaCode", field: "organizationIpaCode" },
    otherKey: { name: "fiscalCode", field: "userFiscalCode" },
    through: OrganizationUser
  });
}

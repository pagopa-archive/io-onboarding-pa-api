import { DataTypes, HasManyCreateAssociationMixin, Model } from "sequelize";
import sequelize from "../database/db";
import { UserRoleEnum } from "../generated/UserRole";
import { Organization } from "./Organization";
import { OrganizationUser } from "./OrganizationUser";
import { Request, RequestScope } from "./Request";
import { Session } from "./Session";

export class User extends Model {
  public email!: string; // PK
  public fiscalCode!: string;
  public givenName!: string;
  public familyName!: string;
  public phoneNumber!: string | null;
  public role!: UserRoleEnum;
  public workEmail!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public readonly organizations?: ReadonlyArray<Organization>;

  // An array of session associated to the user,
  // its value will be populated only when explicitly requested in code
  // according to the inclusion of the relation.
  // @see: https://sequelize.org/master/manual/typescript.html#usage
  public readonly sessions?: ReadonlyArray<Session>;

  // A single session associated to the user,
  // its value will be populated only when explicitly requested in code
  // according to the inclusion of the relation.
  // @see: https://sequelize.org/master/manual/typescript.html#usage
  public readonly session?: Session;

  public createSession!: HasManyCreateAssociationMixin<Session>;

  public readonly request?: Request;
  public readonly requests?: ReadonlyArray<Request>;
  public readonly delegationRequest?: Request;
  public readonly delegationRequests?: ReadonlyArray<Request>;
  public readonly organizationRegistrationRequest?: Request;
  public readonly organizationRegistrationRequests?: ReadonlyArray<Request>;
}

export function init(): void {
  User.init(
    {
      email: {
        allowNull: false,
        primaryKey: true,
        type: new DataTypes.STRING()
      },
      familyName: {
        allowNull: false,
        type: new DataTypes.STRING()
      },
      fiscalCode: {
        allowNull: false,
        type: new DataTypes.STRING()
      },
      givenName: {
        allowNull: false,
        type: new DataTypes.STRING()
      },
      phoneNumber: {
        allowNull: true,
        type: new DataTypes.STRING()
      },
      role: {
        allowNull: false,
        type: new DataTypes.ENUM(...Object.values(UserRoleEnum))
      },
      workEmail: {
        allowNull: true,
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
    as: "organizations",
    foreignKey: { name: "email", field: "userEmail" },
    otherKey: { name: "ipaCode", field: "organizationIpaCode" },
    through: OrganizationUser
  });
  User.hasMany(Session, {
    as: "sessions",
    foreignKey: { name: "email", field: "userEmail" }
  });
  User.hasOne(Session, {
    as: "session",
    foreignKey: { name: "email", field: "userEmail" }
  });
  User.hasMany(Request.scope(RequestScope.ORGANIZATION_REGISTRATION), {
    as: "organizationRegistrationRequests",
    foreignKey: { name: "email", field: "userEmail" }
  });
  User.hasMany(Request.scope(RequestScope.USER_DELEGATION), {
    as: "delegationRequests",
    foreignKey: { name: "email", field: "userEmail" }
  });
  User.hasOne(Request.scope(RequestScope.USER_DELEGATION), {
    as: "delegationRequest",
    foreignKey: { name: "email", field: "userEmail" }
  });
}

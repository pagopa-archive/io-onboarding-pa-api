import { DataTypes, Model } from "sequelize";
import sequelize from "../database/db";
import { OrganizationScopeEnum } from "../generated/OrganizationScope";
import { RequestStatusEnum } from "../generated/RequestStatus";
import { User } from "./User";

export enum RequestType {
  ORGANIZATION_REGISTRATION = "ORGANIZATION_REGISTRATION",
  USER_DELEGATION = "USER_DELEGATION"
}

export enum RequestScope {
  INCLUDE_REQUESTER = "includeRequester",
  ORGANIZATION_REGISTRATION = "organizationRegistration",
  USER_DELEGATION = "userDelegation"
}

export class Request extends Model {
  public id!: number;
  public legalRepresentativeFamilyName!: string;
  public legalRepresentativeGivenName!: string;
  public legalRepresentativeFiscalCode!: string;
  public legalRepresentativePhoneNumber!: string;
  public organizationFiscalCode!: string;
  public organizationIpaCode!: string;
  public organizationName!: string;
  public organizationPec!: string;
  public organizationScope!: OrganizationScopeEnum;
  public status!: RequestStatusEnum;
  public type!: RequestType;

  public readonly createdAt!: Date;
  public readonly deletedAt!: Date;
  public readonly updatedAt!: Date;

  public readonly requester!: User | null;
}

export function init(): void {
  Request.init(
    {
      id: {
        autoIncrement: true,
        primaryKey: true,
        type: new DataTypes.INTEGER()
      },
      legalRepresentativeFamilyName: {
        allowNull: true,
        type: new DataTypes.STRING()
      },
      legalRepresentativeFiscalCode: {
        allowNull: true,
        type: new DataTypes.STRING()
      },
      legalRepresentativeGivenName: {
        allowNull: true,
        type: new DataTypes.STRING()
      },
      legalRepresentativePhoneNumber: {
        allowNull: true,
        type: new DataTypes.STRING()
      },
      organizationFiscalCode: {
        allowNull: true,
        type: new DataTypes.STRING()
      },
      organizationIpaCode: {
        allowNull: true,
        type: new DataTypes.STRING()
      },
      organizationName: {
        allowNull: true,
        type: new DataTypes.STRING()
      },
      organizationPec: {
        allowNull: true,
        type: new DataTypes.STRING()
      },
      organizationScope: {
        allowNull: true,
        type: new DataTypes.ENUM(...Object.values(OrganizationScopeEnum))
      },
      status: {
        allowNull: false,
        defaultValue: RequestStatusEnum.CREATED,
        type: new DataTypes.ENUM(...Object.values(RequestStatusEnum))
      },
      type: {
        allowNull: false,
        type: new DataTypes.ENUM(...Object.values(RequestType))
      },
      userEmail: {
        allowNull: false,
        references: {
          key: "email",
          model: User
        },
        type: new DataTypes.STRING()
      }
    },
    {
      modelName: "Request",
      paranoid: true,
      scopes: {
        [RequestScope.INCLUDE_REQUESTER]: {
          include: [
            {
              as: "requester",
              model: User
            }
          ]
        },
        [RequestScope.ORGANIZATION_REGISTRATION]: {
          where: {
            type: RequestType.ORGANIZATION_REGISTRATION
          }
        },
        [RequestScope.USER_DELEGATION]: {
          where: {
            type: RequestType.USER_DELEGATION
          }
        }
      },
      sequelize,
      tableName: "Requests",
      timestamps: true
    }
  );
}

export function createAssociations(): void {
  Request.belongsTo(User, {
    as: "requester",
    foreignKey: { name: "email", field: "userEmail" }
  });
}

import { DataTypes, Model } from "sequelize";
import sequelize from "../database/db";
import { PublicAdministration } from "./PublicAdministration";
import { User, UserType } from "./User";

export class PaUser extends Model {
  public type!: UserType;
}

PaUser.init(
  {
    type: new DataTypes.ENUM(...Object.values(UserType))
  },
  { sequelize, modelName: "PaUser", tableName: "PA_User" }
);

PublicAdministration.belongsToMany(User, {
  foreignKey: { name: "ipaCode", field: "ipa_code" },
  otherKey: { name: "fc", field: "FC" },
  through: PaUser
});

User.belongsToMany(PublicAdministration, {
  foreignKey: { name: "fc", field: "FC" },
  otherKey: { name: "ipaCode", field: "ipa_code" },
  through: PaUser
});

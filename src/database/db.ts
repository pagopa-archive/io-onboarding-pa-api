import { Sequelize } from "sequelize";
import { log } from "../utils/logger";
import { config } from "./config";

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    dialect: "postgres",
    host: config.host,
    logging: sql => log.debug("%s", sql)
  }
);

export default sequelize;

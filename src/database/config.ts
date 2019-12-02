import { getRequiredEnvVar } from "../utils/environment";

export const config = {
  database: getRequiredEnvVar("POSTGRESQL_DATABASE"),
  dialect: "postgres",
  host: getRequiredEnvVar("POSTGRESQL_HOST"),
  password: getRequiredEnvVar("POSTGRESQL_PASSWORD"),
  username: getRequiredEnvVar("POSTGRESQL_USERNAME")
};

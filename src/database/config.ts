import { getRequiredEnvVar } from "../utils/environment";

export const config = {
  database: getRequiredEnvVar("PGDATABASE"),
  dialect: "postgres",
  host: getRequiredEnvVar("PGHOST"),
  password: getRequiredEnvVar("PGPASSWORD"),
  username: getRequiredEnvVar("PGUSER")
};

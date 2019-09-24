import { getRequiredEnvVar } from "../utils/environment";

export const config = {
  database: getRequiredEnvVar("POSTGRES_DB"),
  dialect: "postgres",
  host: getRequiredEnvVar("POSTGRES_HOST"),
  password: getRequiredEnvVar("POSTGRES_PASSWORD"),
  username: getRequiredEnvVar("POSTGRES_USER")
};

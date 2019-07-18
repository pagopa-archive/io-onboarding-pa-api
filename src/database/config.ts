import { log } from "../utils/logger";

if (
  !process.env.PGDATABASE ||
  !process.env.PGHOST ||
  !process.env.PGPASSWORD ||
  !process.env.PGUSER
) {
  log.error(
    "The following environment variables are required by the application: PGDATABASE, PGHOST, PGPASSWORD, PGUSER"
  );
  process.exit(1);
}

export const config = {
  database: process.env.PGDATABASE as string,
  dialect: "postgres",
  host: process.env.PGHOST as string,
  password: process.env.PGPASSWORD as string,
  username: process.env.PGUSER as string
};

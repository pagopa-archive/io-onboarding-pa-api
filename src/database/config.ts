export const config = {
  database: process.env.PGDATABASE || "db",
  dialect: "postgres",
  host: process.env.PGHOST || "localhost",
  password: process.env.PGPASSWORD || "password",
  username: process.env.PGUSER || "postgres"
};

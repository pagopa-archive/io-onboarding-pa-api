// Before importing any other module,
// loads all the environment variables from a .env file
// @see https://github.com/motdotla/dotenv/tree/v6.1.0#how-do-i-use-dotenv-with-import
import * as dotenv from "dotenv";
dotenv.config();

import * as path from "path";
import { Sequelize } from "sequelize";
import * as usync from "umzug-sync";
import { populateIpaPublicAdministrationTable } from "../services/ipaPublicAdministrationService";
import { log } from "../utils/logger";
import sequelize from "./db";

/**
 * Apply migrations to db and populate the table of public administrations from IPA
 */
usync
  .migrate({
    SequelizeImport: Sequelize,
    logging: (param: string) => log.info("%s", param),
    migrationsDir: path.join("dist", "migrations"),
    sequelize
  })
  .catch(error => {
    log.error("Failed to apply migrations. %s", error);
    process.exit(1);
  })
  .then(() => populateIpaPublicAdministrationTable())
  // tslint:disable-next-line:no-floating-promises
  .then(hasBeenPopulated => {
    log.info(
      hasBeenPopulated
        ? "IpaPublicAdministrations table has been populated."
        : "IpaPublicAdministrations table is already populated."
    );
  });

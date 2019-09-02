// Before running the app and importing any other module,
// loads all the environment variables from a .env file
// @see https://github.com/motdotla/dotenv/tree/v6.1.0#how-do-i-use-dotenv-with-import
import * as dotenv from "dotenv";
dotenv.config();

import { schedule } from "node-cron";
import newApp from "./app";
import {
  init as initIpaPublicAdministration,
  IpaPublicAdministration
} from "./models/IpaPublicAdministration";
import { upsertFromIpa } from "./services/ipaPublicAdministrationService";
import { log } from "./utils/logger";

/**
 * Populates the table of Public Administrations from IPA if it's still empty
 */
async function populateIpaPublicAdministrationTable(): Promise<void> | never {
  try {
    initIpaPublicAdministration();
    const IpaPublicAdministrationCount = await IpaPublicAdministration.count();
    if (IpaPublicAdministrationCount === 0) {
      log.debug("Populating IpaPublicAdministration table...");
      // tslint:disable-next-line:no-floating-promises
      upsertFromIpa();
    } else {
      log.debug("IpaPublicAdministration table already populated.");
    }
  } catch (error) {
    log.error(
      "An error occurred counting entries in IpaPublicAdministration table."
    );
    return process.exit(1);
  }
}

newApp()
  .then(app => {
    // tslint:disable-next-line:no-floating-promises
    populateIpaPublicAdministrationTable();
    app.listen(app.get("port"), () => {
      log.info(
        "  App is running at http://localhost:%d in %s mode",
        app.get("port"),
        app.get("env")
      );
      log.info("  Press CTRL-C to stop\n");
    });
  })
  .catch(error => log.error("Error loading app: %s", error));

schedule(
  "0 0 2 * * *", // running in container at 02:00 UTC
  () => {
    log.info("Updating public administrations from IPA...");
    // tslint:disable-next-line:no-floating-promises
    upsertFromIpa();
  }
).start();

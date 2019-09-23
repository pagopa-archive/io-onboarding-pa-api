// Before running the app and importing any other module,
// loads all the environment variables from a .env file
// @see https://github.com/motdotla/dotenv/tree/v6.1.0#how-do-i-use-dotenv-with-import
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({
  path: path.resolve(process.cwd(), ".env.example")
});

import { schedule } from "node-cron";
import newApp from "./app";
import { upsertFromIpa } from "./services/ipaPublicAdministrationService";
import { log } from "./utils/logger";

newApp()
  .then(app => {
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
    upsertFromIpa()
      .then(() => log.info("Public administrations from IPA have been updated"))
      .catch(error =>
        log.error("Update of public administrations from IPA failed: %s", error)
      );
  }
).start();

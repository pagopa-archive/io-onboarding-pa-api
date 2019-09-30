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

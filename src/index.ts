import { schedule } from "node-cron";
import newApp from "./app";
import EmailService from "./services/emailService";
import { upsertFromIpa } from "./services/ipaPublicAdministrationService";
import { getRequiredEnvVar } from "./utils/environment";
import { log } from "./utils/logger";

const emailService = new EmailService({
  auth: {
    pass: getRequiredEnvVar("EMAIL_PASSWORD"),
    user: getRequiredEnvVar("EMAIL_USER")
  },
  from: getRequiredEnvVar("EMAIL_SENDER"),
  host: getRequiredEnvVar("EMAIL_SMTP_HOST"),
  port: Number(getRequiredEnvVar("EMAIL_SMTP_PORT")),
  secure: getRequiredEnvVar("EMAIL_SMTP_SECURE") === "true"
});

newApp(emailService)
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

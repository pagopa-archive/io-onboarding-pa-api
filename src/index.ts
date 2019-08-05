import * as dotenv from "dotenv";
import newApp from "./app";
import { log } from "./utils/logger";

// Before running the app, loads all the environment variables from a .env files
dotenv.config();

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

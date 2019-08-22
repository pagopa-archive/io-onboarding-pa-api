// Before running the app and importing any other module,
// loads all the environment variables from a .env file
// @see https://github.com/motdotla/dotenv/tree/v6.1.0#how-do-i-use-dotenv-with-import
import * as dotenv from "dotenv";
dotenv.config();

import newApp from "./app";
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

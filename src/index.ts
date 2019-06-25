import newApp from "./app";
import { log } from "./utils/logger";

// tslint:disable-next-line:no-let
let server;
newApp()
  .then(app => {
    server = app.listen(app.get("port"), () => {
      log.info(
        "  App is running at http://localhost:%d in %s mode",
        app.get("port"),
        app.get("env")
      );
      log.info("  Press CTRL-C to stop\n");
    });
  })
  .catch(error => log.error("Error loading app: %s", error));

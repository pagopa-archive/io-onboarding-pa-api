import app from "./app";
import { log } from "./utils/logger";

const server = app.listen(app.get("port"), () => {
  log.info(
    "  App is running at http://localhost:%d in %s mode",
    app.get("port"),
    app.get("env")
  );
  log.info("  Press CTRL-C to stop\n");
});

export default server;

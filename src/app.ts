import * as bodyParser from "body-parser";
import * as express from "express";
import { Pool } from "pg";

import { log } from "./utils/logger";

// Create Express server
const app = express();

const timeout = 5000;

const postgres = new Pool({
  connectionString: "postgres://postgres:password@database/postgres"
});

function createConnection(db: Pool): Promise<void> {
  return new Promise((resolve, reject) => {
    db.connect((errorConnect, _2, done) => {
      if (errorConnect) {
        return reject(errorConnect);
      }
      resolve();
      done();
    });
  });
}

// tslint:disable-next-line:no-let
let retries = 10;
function tryToConnect(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    while (retries) {
      try {
        log.info("Attempting to connect to database...");
        await createConnection(postgres);
        return resolve();
      } catch (error) {
        log.error(error);
        retries--;
        log.info("Retries left: %d", retries);
        await new Promise(res => setTimeout(res, timeout));
      }
    }
    reject();
  });
}

tryToConnect()
  .then(() => log.info("Connected to database!"))
  .catch(() => log.error("Failed to connect to database."));

// Express configuration
app.set("port", process.env.PORT || 3000);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (_0, res) => {
  res.json({ text: "Hello world!" });
});

export default app;

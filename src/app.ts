import * as bodyParser from "body-parser";
import * as express from "express";
import { Express } from "express";
import { Pool } from "pg";

import { log } from "./utils/logger";

// Create Express server
const app = express();

const timeout = 5000;

const dbParams = {
  host: process.env.POSTGRES_HOST || "localhost",
  password: process.env.POSTGRES_PASSWORD || "password",
  user: process.env.POSTGRES_USER || "postgres"
};
const postgres = new Pool({
  connectionString: `postgres://${dbParams.user}:${dbParams.password}@${dbParams.host}/postgres`
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

async function tryToConnect(): Promise<void> {
  // tslint:disable-next-line:no-let
  let retries = 10;
  while (retries) {
    try {
      log.info("Attempting to connect to database...");
      await createConnection(postgres);
      log.info("Successfully connected to database.");
      return;
    } catch (error) {
      log.error(error);
      retries--;
      log.info("Retries left: %d", retries);
      await new Promise(res => setTimeout(res, timeout));
    }
  }
  return Promise.reject("Attempt to connect to database failed.");
}

// Express configuration
app.set("port", process.env.PORT || 3000);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (_0, res) => {
  res.json({ text: "Hello world!" });
});

export default async function newApp(): Promise<Express> {
  try {
    await tryToConnect();
    return app;
  } catch (error) {
    return Promise.reject(error);
  }
}

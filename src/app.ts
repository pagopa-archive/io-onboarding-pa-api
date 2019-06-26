import * as bodyParser from "body-parser";
import * as express from "express";
import { Express } from "express";
import { Pool } from "pg";

import { log } from "./utils/logger";

const postgres = new Pool();

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

export default async function newApp(): Promise<Express> {
  // Create Express server
  const app = express();

  // Express configuration
  app.set("port", process.env.PORT || 3000);
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  app.get("/", (_0, res) => {
    res.json({ text: "Hello world!" });
  });

  try {
    await createConnection(postgres);
  } catch (error) {
    log.error("Failed to connect to database. %s", error);
    process.exit(1);
  }
  return app;
}

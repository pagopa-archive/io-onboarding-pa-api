// TODO: write you code here
import { schedule } from "node-cron";
import { log } from "../../src/utils/logger";
import * as U from "./utils/utils";

const verifyAttachments = () =>
  U.verifyAllAttachments.map(taskEmails => {
    taskEmails
      .run()
      // only for showing results about data
      // tslint:disable-next-line: no-console
      .then(email => console.log(email))
      // tslint:disable-next-line: no-console
      .catch(e => console.log(e));
  });

async function Main(): Promise<void> {
  await verifyAttachments().run();
}

Main().catch(e => {
  // tslint:disable-next-line: no-console
  log.error(e);
});

// tslint:disable-next-line: no-commented-code
// schedule(
//  "*/1 * * * *", // running job every one minute
//  () => {
//    log.info("Downloading attachments and verifying signatures ");
//    Main()
//      .then(() => log.info("Downloaded and verified email messages"))
//      .catch(error => log.error("Downoload and verify error: %s", error));
//  }
// ).start();

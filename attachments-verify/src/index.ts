// TODO: write you code here

import { array } from "fp-ts/lib/Array";
import { taskEither, TaskEither } from "fp-ts/lib/TaskEither";
import * as Imap from "imap-simple";
import { schedule } from "node-cron";
import { log } from "../../src/utils/logger";

import {
  fetchOptions,
  imapOption,
  searchCriteria,
  urlDemoAruba
} from "../src/domain/data";
import * as ImapFunctions from "../src/imap/imapFunctions";
import * as ArubaVerify from "../src/verify-sign/wsaruba";

const verifyAllAttachments = ImapFunctions.imap2(
  Imap.connect,
  imapOption
).chain(imap =>
  ImapFunctions.openInbox(imap)
    .chain(() => ImapFunctions.searchMails(imap, searchCriteria, fetchOptions))
    .map(messages =>
      array.sequence(taskEither)(ImapFunctions.getAttachments(imap, messages))
    )
    .chain(task => task)
    .map(attachments =>
      attachments.map(attachment => ArubaVerify.verify(attachment.data))
    )
);

const verifyAttachments = () =>
  verifyAllAttachments.run().then(errOrTask => {
    errOrTask.fold(
      error => {
        throw new Error(String(error));
      },
      tasks => tasks.map(task => task.run())
    );
  });

async function Main(): Promise<void> {
  await verifyAttachments();
}

// Main().catch(e => {
// tslint:disable-next-line: no-console
//  log.error(e);
// });

schedule(
  "*/1 * * * *", // running job every one minute
  () => {
    log.info("Downloading attachments and verifying signatures ");
    Main()
      .then(() => log.info("Downloaded and verified email messages"))
      .catch(error => log.error("Downoload and verify error: %s", error));
  }
).start();

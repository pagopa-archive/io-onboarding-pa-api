// TODO: write you code here

import { array } from "fp-ts/lib/Array";
import { taskEither, TaskEither } from "fp-ts/lib/TaskEither";
import * as Imap from "imap-simple";
import { schedule } from "node-cron";
import { log } from "../../src/utils/logger";

import { task, Task } from "fp-ts/lib/Task";
import { fetchOptions, imapOption, searchCriteria } from "../src/domain/data";
import * as ImapFunctions from "../src/imap/imapFunctions";
import * as ArubaVerify from "../src/verify-sign/wsaruba";
import { IEmailAttachmentStatus } from "./domain/models";

// TODO move to some utils
// used to create an IEmailAttachmentStatus with
// an array of n attachments. Used to reduce from many emails with same id
// and different attachments into one email with many attachments and
// signature  status
const mergeSameEmails = (emails: readonly IEmailAttachmentStatus[]) => {
  const grouped = emails.reduce(
    (acc, item) => ({
      ...acc,
      [item.messageId]: [...(acc[item.messageId] || []), item]
    }),
    // tslint:disable-next-line: no-any
    {} as any
  );
  // tslint:disable-next-line: prefer-immediate-return
  return Object.keys(grouped).map(key => {
    const info = grouped[key] as readonly IEmailAttachmentStatus[];
    return info.reduce(
      (acc: IEmailAttachmentStatus, obj: IEmailAttachmentStatus) => ({
        ...acc,
        ["attachments"]: [...obj.attachments, ...acc.attachments]
      })
    );
  });
};

// Algorithm for connecting to imap server query for messages
// download attachments and verify signatures.
const verifyAllAttachments: TaskEither<
  Error,
  Task<readonly IEmailAttachmentStatus[]>
  // Connect to imap server
> = ImapFunctions.imap(Imap.connect, imapOption).chain(imap =>
  // Open inbox
  ImapFunctions.openInbox(imap)
    // get all emails
    .chain(() => ImapFunctions.searchMails(imap, searchCriteria, fetchOptions))
    // get all attachments in parallel
    .map(messages =>
      array.sequence(taskEither)(ImapFunctions.getAttachments(imap, messages))
    )
    .chain(tasks => tasks)
    // verify all attachments
    .map(attachments =>
      array
        .sequence(task)(
          attachments.map(attachment => {
            return ArubaVerify.verify(attachment);
          })
        )
        // merge emails with same id and concat attachments and status
        .map(emailsStatus => mergeSameEmails(emailsStatus))
    )
);

const verifyAttachments = () =>
  verifyAllAttachments.map(taskEmails => {
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

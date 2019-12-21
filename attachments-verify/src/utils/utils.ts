import { array } from "fp-ts/lib/Array";
import { task, Task } from "fp-ts/lib/Task";
import { taskEither, TaskEither } from "fp-ts/lib/TaskEither";
import * as Imap from "imap-simple";
import {
  fetchOptions,
  imapOption,
  searchCriteria
} from "../../src/domain/data";
import * as ImapFunctions from "../../src/imap/imapFunctions";
import * as ArubaVerify from "../../src/verify-sign/wsaruba";
import { IEmailAttachmentStatus } from "../domain/models";

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
export const verifyAllAttachments: TaskEither<
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
        .map(emailsStatus => {
          // close imap server
          imap.end();
          // merge mails with same id resembling email + attachments
          return mergeSameEmails(emailsStatus);
        })
    )
);

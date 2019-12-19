import { TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
import { FetchOptions } from "imap";
import * as Imap from "imap-simple";
import { IEmailAttachmentStatus } from "../domain/models";

// Open a connection to imap server
export type ImapConnect = (
  options: Imap.ImapSimpleOptions
) => Promise<Imap.ImapSimple>;

export const imap = (
  connect: ImapConnect,
  imapOptions: Imap.ImapSimpleOptions
) => {
  return tryCatch(
    () => connect(imapOptions),
    reason => new Error(String(reason))
  );
};

// Open the INBOX
export const openInbox = (
  imapServer: Imap.ImapSimple
): TaskEither<Error, string> => {
  return tryCatch(
    () => imapServer.openBox("INBOX"),
    reason => new Error(String(reason))
  );
};

// Query for email messages
export const searchMails = (
  imapServer: Imap.ImapSimple,
  // tslint:disable-next-line: no-any
  criteria: ReadonlyArray<any>,
  fOptions: FetchOptions
  // tslint:disable-next-line: readonly-array
): TaskEither<Error, Imap.Message[]> => {
  return tryCatch(
    () => imapServer.search([...criteria], fOptions),
    reason => new Error(String(reason))
  );
};

// Extract an attachment file
export const extractAttachment = (
  imapServer: Imap.ImapSimple,
  message: Imap.Message,
  // tslint:disable-next-line: no-any
  attach: any
): TaskEither<Error, IEmailAttachmentStatus> => {
  return tryCatch(
    () =>
      imapServer.getPartData(message, attach).then(attachment => {
        return message.parts
          .filter(partHeader => partHeader.which === "HEADER")
          .map(header => {
            return {
              attachments: [
                {
                  data: attachment,
                  filename: attach.disposition.params.filename,
                  message: message.attributes.uid.toString()
                }
              ],
              date: header.body.date as readonly string[],
              from: header.body.from as readonly string[],
              messageId: message.attributes.uid.toString(),
              subject: header.body.subject as readonly string[],
              to: header.body.to as readonly string[]
            };
          })[0];
      }),
    reason => new Error(String(reason))
  );
};

// Get all attachments from INBOX
export const getAttachments = (
  imapServer: Imap.ImapSimple,
  messages: readonly Imap.Message[]
  // tslint:disable-next-line: readonly-array
): Array<TaskEither<Error, IEmailAttachmentStatus>> => {
  return messages
    .map(message => {
      const parts = Imap.getParts(
        // tslint:disable-next-line: readonly-array no-any
        message.attributes.struct as any[]
      );
      // tslint:disable-next-line: readonly-array
      return parts
        .filter(
          part =>
            part.disposition &&
            part.disposition.type.toUpperCase() === "ATTACHMENT"
        )
        .map(attach => extractAttachment(imapServer, message, attach));
    })
    .reduce((accumulator, value) => accumulator.concat(value), []);
};

import { TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
import { FetchOptions } from "imap";
import * as Imap from "imap-simple";
import { IMessageAttachment } from "../domain/models";

// Open a connection to imap server
export const imap = (
  imapOptions: Imap.ImapSimpleOptions
): TaskEither<Error, Imap.ImapSimple> => {
  return tryCatch(
    () => Imap.connect(imapOptions),
    reason => new Error(String(reason))
  );
};

export type ImapConnect = (
  options: Imap.ImapSimpleOptions
) => Promise<Imap.ImapSimple>;

export const imap2 = (
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

// Get partData attachments from message
export const partData = (
  imapServer: Imap.ImapSimple,
  message: Imap.Message,
  // tslint:disable-next-line: no-any
  attach: any
  // tslint:disable-next-line: no-any
): TaskEither<Error, any> => {
  return tryCatch(
    () => imapServer.getPartData(message, attach),
    reason => new Error(String(reason))
  );
};

// Extract an attachment file
export const extractAttachment = (
  imapServer: Imap.ImapSimple,
  message: Imap.Message,
  // tslint:disable-next-line: no-any
  attach: any
): TaskEither<Error, IMessageAttachment> => {
  return tryCatch(
    () =>
      imapServer.getPartData(message, attach).then(attachment => {
        return {
          data: attachment,
          filename: attach.disposition.params.filename,
          message: message.attributes.uid.toString()
        };
      }),
    reason => new Error(String(reason))
  );
};

// Get all attachments from INBOX
export const getAttachments = (
  imapServer: Imap.ImapSimple,
  messages: readonly Imap.Message[]
  // tslint:disable-next-line: readonly-array
): Array<TaskEither<Error, IMessageAttachment>> => {
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

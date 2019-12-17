import { EmailString } from "italia-ts-commons/lib/strings";
import * as t from "io-ts";

export interface IMessageAttachment {
  // tslint:disable-next-line: no-any
  data: any;
  filename: string;
  message: string;
  attachmentStatus?: IAttachmentStatus;
}

type AttachmentStatus = "OK" | "ERROR";

export interface IEmailAttachmentStatus {
  messageId: string;
  from: readonly string[];
  to: readonly string[];
  subject: readonly string[];
  date: readonly string[];
  // tslint:disable-next-line: readonly-array
  attachments: IMessageAttachment[];
}

export interface IAttachmentStatus {
  status: AttachmentStatus;
  signers?: any;
  operation: string;
}

// I would like to learn how to use t
const TestMessage = t.type({
  receiver: t.string,
  sender: t.string
});

// tslint:disable-next-line: no-commented-code
/*
const IMessageAttachmet = t.interface({
  data: t.any,
  filename: t.string,
  message: t.string
});
*/

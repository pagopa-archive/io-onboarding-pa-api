import { none, Option, some } from "fp-ts/lib/Option";
import * as nodemailer from "nodemailer";
import { log } from "../utils/logger";

export interface ITransporterOptions {
  auth: {
    pass: string;
    user: string;
  };
  host: string;
  port: number;
  secure: boolean;
}

interface ITransporter {
  // tslint:disable-next-line:no-any
  sendMail: (mailOptions: IMailOptions) => Promise<any>;
  verify: () => Promise<true>;
}

export interface IMailOptions {
  // tslint:disable-next-line:readonly-array
  attachments?: Array<{ path: string; cid?: string }>;
  from: string;
  html: string;
  subject: string;
  text: string;
  to: string;
}

export default class EmailService {
  private transporter: ITransporter;
  public constructor(transporterConfig: ITransporterOptions) {
    this.transporter = nodemailer.createTransport(transporterConfig);
    this.transporter
      .verify()
      .then(() => log.info("SMTP server is ready to accept messages"))
      .catch(error => log.error("Error on SMTP transport creation. %s", error));
  }

  public send(mailOptions: IMailOptions): Promise<Option<Error>> {
    return this.transporter
      .sendMail(mailOptions)
      .then(() => none)
      .catch(some);
  }
}

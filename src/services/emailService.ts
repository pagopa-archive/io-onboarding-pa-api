import { none, Option, some } from "fp-ts/lib/Option";
import * as nodemailer from "nodemailer";

export interface ITransporterOptions {
  auth: {
    pass: string;
    user: string;
  };
  host: string;
  port: number;
  secure: boolean;
  from: string;
}

interface ITransporter {
  // tslint:disable-next-line:no-any
  sendMail: (mailOptions: IMailOptions) => Promise<any>;
  verify: () => Promise<true>;
}

export interface IMailOptions {
  // tslint:disable-next-line:readonly-array
  attachments?: Array<{ path: string; cid?: string }>;
  html: string;
  subject: string;
  text: string;
  to: string;
}

export default class EmailService {
  private transporter: ITransporter;
  public constructor(transporterConfig: ITransporterOptions) {
    this.transporter = nodemailer.createTransport(transporterConfig);
  }

  public send(mailOptions: IMailOptions): Promise<Option<Error>> {
    return this.transporter
      .sendMail(mailOptions)
      .then(() => none)
      .catch(some);
  }

  public verifyTransport(): Promise<true> {
    return this.transporter.verify();
  }
}

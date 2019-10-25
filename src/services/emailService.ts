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

export default class EmailService {
  private transporter: nodemailer.Transporter;
  public constructor(transporterConfig: ITransporterOptions) {
    this.transporter = nodemailer.createTransport(transporterConfig);
  }

  public send(mailOptions: nodemailer.SendMailOptions): Promise<Option<Error>> {
    return this.transporter
      .sendMail(mailOptions)
      .then(() => none)
      .catch(some);
  }

  public verifyTransport(): Promise<true> {
    return this.transporter.verify();
  }
}

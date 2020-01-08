import * as nodemailer from "nodemailer";

// tslint:disable-next-line: no-submodule-imports
import SMTPTransport = require("nodemailer/lib/smtp-transport");

export default class EmailService {
  private transporter: nodemailer.Transporter;
  public constructor(
    transporterConfig: SMTPTransport.Options,
    defaults: SMTPTransport.Options
  ) {
    this.transporter = nodemailer.createTransport(transporterConfig, defaults);
  }

  // tslint:disable-next-line:no-any
  public send(mailOptions: nodemailer.SendMailOptions): Promise<any> {
    return this.transporter.sendMail(mailOptions);
  }

  public verifyTransport(): Promise<true> {
    return this.transporter.verify();
  }
}

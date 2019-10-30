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

  // tslint:disable-next-line:no-any
  public send(mailOptions: nodemailer.SendMailOptions): Promise<any> {
    return this.transporter.sendMail(mailOptions);
  }

  public verifyTransport(): Promise<true> {
    return this.transporter.verify();
  }
}

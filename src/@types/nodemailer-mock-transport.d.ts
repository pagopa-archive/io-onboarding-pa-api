declare module "nodemailer-mock-transport" {
  import * as NodeMailer from "nodemailer";

  interface IMimeNode {
    date: Date;
    childNodes: ReadonlyArray<IMimeNode>;
    content: string | Buffer;
  }

  interface ISentEmail {
    data: NodeMailer.SendMailOptions;
    message: IMimeNode;
  }

  interface IMockTransport {
    // tslint:disable-next-line:no-any
    options: any;
    sentMail: ReadonlyArray<ISentEmail>;
  }

  function index(options: {
    auth: {
      pass: string;
      user: string;
    };
    host: string;
    port: number;
    secure: boolean;
    from: string;
  }): NodeMailer.Transport & IMockTransport;

  export = index;
}

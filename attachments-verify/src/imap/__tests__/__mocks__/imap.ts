import { Config } from "imap";
import { ImapSimpleOptions } from "imap-simple";

const config: Config = {
  user: "xxxxxx@gmail.com",
  password: "xxxxxxx",
  host: "imap.gmail.com",
  port: 993,
  tls: true,
  authTimeout: 3000
};

// to import common
//const aValidEmailAddress = "garibaldi@example.com" as EmailString;

const imapOptions: ImapSimpleOptions = {
  imap: config
};

class ImapSimple {
  protected openBox = (boxName: string) =>
    new Promise((resolve, reject) => {
      boxName === "INBOX"
        ? resolve(boxName)
        : reject("wrong boxName : " + boxName);
    });
}

const imapMock = {
  connect: (options: ImapSimpleOptions) => {
    return new ImapSimple();
  }
};

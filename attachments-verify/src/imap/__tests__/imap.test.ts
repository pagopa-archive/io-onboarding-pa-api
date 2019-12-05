//import { Config } from "imap";
import * as Imap from "imap";
import * as imapsimple from "imap-simple";
//import { ImapSimple } from "imap-simple";
import * as ImapFunctions from "../imapFunctions";
import { right } from "fp-ts/lib/Either";

//jest.mock("winston");

const config: Imap.Config = {
  user: "xxxxxx@gmail.com",
  password: "xxxxxxx",
  host: "imap.gmail.com",
  port: 993,
  tls: true,
  authTimeout: 3000
};

const imapOptions: imapsimple.ImapSimpleOptions = {
  imap: config
};

//jest.genMockFromModule("imap");
type ImapSimple = typeof imapsimple;
const imapS = jest.genMockFromModule<ImapSimple>("imap-simple");
const imapoold = jest.genMockFromModule("imap");

console.log(imapoold);

describe("Connect to imap server read INBOX UNSEEN messages and extract attachments", () => {
  it("should connect to an imap server with the right credentials", async () => {
    const connectMock = jest.fn((options: imapsimple.ImapSimpleOptions) => {
      return Promise.resolve(imapS);
    });
    const imapFunc = await ImapFunctions.imap2(
      imapS.connect,
      imapOptions
    ).run();

    //expect(imapMock.connect).toHaveBeenCalledTimes(1);
    console.log(imapFunc);
    expect(imapFunc.isRight()).toBeTruthy();
  });
});

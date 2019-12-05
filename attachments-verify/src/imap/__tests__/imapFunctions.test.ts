//import { Config } from "imap";
import * as Imap from "imap";
import * as ImapSimpleModule from "imap-simple";
import { ImapSimple } from "imap-simple";
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

// to import common
//const aValidEmailAddress = "garibaldi@example.com" as EmailString;

const imapOptions: ImapSimpleModule.ImapSimpleOptions = {
  imap: config
};

/*class ImapSimple {
  protected openBox = (boxName: string) =>
    new Promise((resolve, reject) => {
      boxName === "INBOX"
        ? resolve(boxName)
        : reject("wrong boxName : " + boxName);
    });
}*/

jest.genMockFromModule("imap");
jest.mock("imap", () => {
  return jest.fn().mockImplementation(() => {
    return {
      connect: (options: ImapSimpleModule.ImapSimpleOptions) => {
        return Promise.resolve(
          new ImapSimpleModule.ImapSimple(new Imap(options.imap))
        );
      }
    };
  });
});

jest.genMockFromModule("imap-simple");
jest.mock("imap-simple", () => {
  return jest
    .fn()
    .mockImplementation((options: ImapSimpleModule.ImapSimpleOptions) => {
      return {
        openBox: (boxName: string) => {
          return new Promise((resolve, reject) => {
            boxName === "INBOX"
              ? resolve(boxName)
              : reject("wrong boxName : " + boxName);
          });
        }
      };
    });
});

const connectMock = jest.fn((options: ImapSimpleModule.ImapSimpleOptions) => {
  return Promise.resolve(new ImapSimple(new Imap(options.imap)));
});

/*connect: (options: ImapSimpleModule.ImapSimpleOptions) => {
  return Promise.resolve(new ImapSimple(new Imap(options.imap)));
}*/

/*const imapMock = {
  connect: (options: ImapSimpleModule.ImapSimpleOptions) => {
    return Promise.resolve(new ImapSimple(new Imap(options.imap)));
  }
};*/

describe("Connect to imap server read INBOX UNSEEN messages and extract attachments", () => {
  it("should connect to an imap server with the right credentials", async () => {
    const imapFunc = await ImapFunctions.imap2(connectMock, imapOptions).run();

    //expect(imapMock.connect).toHaveBeenCalledTimes(1);
    console.log(imapFunc);
    expect(imapFunc.isRight()).toBeTruthy();
  });
});

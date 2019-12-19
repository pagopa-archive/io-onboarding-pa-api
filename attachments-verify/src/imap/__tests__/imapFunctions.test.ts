//import { Config } from "imap";
import * as Imap from "imap";
import * as ImapSimpleModule from "imap-simple";
import { ImapSimple } from "imap-simple";
import * as ImapFunctions from "../imapFunctions";
import { right } from "fp-ts/lib/Either";
import { taskEither } from "fp-ts/lib/TaskEither";
import { task } from "fp-ts/lib/Task";
import { fetchOptions, searchCriteria } from "../../domain/data";

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

/*
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
}); */

jest.mock("../../imap/imapFunctions", () => {
  const originalImapFunctions = jest.requireActual("../../imap/imapFunctions");
  return {
    __esModule: true,
    ...originalImapFunctions,
    openInbox: jest.fn((imapServer: ImapSimpleModule.ImapSimple) =>
      taskEither.of("INBOX")
    ),
    searchMails: jest.fn((
      imapServer: ImapSimpleModule.ImapSimple,
      // tslint:disable-next-line: no-any
      criteria: ReadonlyArray<any>,
      fOptions: Imap.FetchOptions
    ) => taskEither.of([{} as ImapSimpleModule.Message]))
  };
});

const connectMock = jest.fn((options: ImapSimpleModule.ImapSimpleOptions) => {
  return Promise.resolve({} as ImapSimple);
});

describe("Connect to imap server read INBOX UNSEEN messages and extract attachments", () => {
  it("should connect to an imap server with the right credentials", async () => {
    const imapFunc = await ImapFunctions.imap(connectMock, imapOptions).run();
    expect(imapFunc.isRight()).toBeTruthy();
  });
  it("it should open the email 'INBOX'", async () => {
    const openInbox = await ImapFunctions.openInbox(
      {} as ImapSimpleModule.ImapSimple
    ).run();
    expect(openInbox.isRight()).toBeTruthy();
    expect(openInbox.getOrElse("ERROR")).toEqual("INBOX");
  });

  it("it should search for Messages in INBOX", async () => {
    const searchMails = await ImapFunctions.searchMails(
      {} as ImapSimpleModule.ImapSimple,
      searchCriteria,
      fetchOptions
    ).run();
    expect(searchMails.isRight()).toBeTruthy();
    expect(searchMails.getOrElse([])).toContainEqual({});
    expect(searchMails.getOrElse([])).toHaveLength(1);
  });
});

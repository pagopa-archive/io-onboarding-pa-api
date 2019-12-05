import * as soap from "soap";
import { Client } from "soap";
import * as ArubaVerify from "../../verify-sign/wsaruba";

/**
 * const createClientAruba = (urlWsd: string): TaskEither<Error, Client> => {
  return tryCatch(
    () => soap.createClientAsync(urlWsd),
    reason => new Error(String(reason))
  );
};
 */

jest.mock("soap", () => {
  return jest.fn().mockImplementation(() => {
    return {
      createClientAsync: (urlWsd: string) => {
        return soap.createClientAsync(urlWsd);
      }
    };
  });
});

describe("Connect to imap server read INBOX UNSEEN messages and extract attachments", () => {
  it("should connect to an imap server with the right credentials", async () => {
    const wsFunc = await ArubaVerify.createClientAruba("ale").run();

    //expect(imapMock.connect).toHaveBeenCalledTimes(1);
    console.log(wsFunc);
    expect(wsFunc.isRight()).toBeTruthy();
  });
});

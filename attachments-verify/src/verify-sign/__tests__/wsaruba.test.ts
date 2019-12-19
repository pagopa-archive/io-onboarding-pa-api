import { right } from "fp-ts/lib/Either";
import { task } from "fp-ts/lib/Task";
import * as soap from "soap";
import { urlDemoAruba } from "../../domain/data";
import { IEmailAttachmentStatus } from "../../domain/models";
import * as ArubaVerify from "../../verify-sign/wsaruba";

const emailAttachmentsMock = {
  attachments: [
    {
      data: "base64string in binary format",
      filename: "filename",
      message: "64"
    }
  ],
  date: ["Fri, 06 Dec 2019 22:38:57 +0000"],
  from: ["ente@mail.com"],
  messageId: "64",
  subject: ["Registrazione presso la piattaforma IO"],
  to: ["example@mail.com"]
} as IEmailAttachmentStatus;

const emailAttachmentsWithStatusMock = {
  ...emailAttachmentsMock,
  attachments: [
    {
      ...emailAttachmentsMock.attachments[0],
      attachmentStatus: {
        operation: "Verify PDF",
        status: "OK"
      }
    }
  ]
} as IEmailAttachmentStatus;

jest.mock("../../verify-sign/wsaruba", () => {
  const originalWsAruba = jest.requireActual("../../verify-sign/wsaruba");
  return {
    __esModule: true,
    ...originalWsAruba,
    verify: jest.fn((email: IEmailAttachmentStatus) =>
      task.of(emailAttachmentsWithStatusMock)
    )
  };
});

jest.mock("soap", () => {
  const originalSoapModule = jest.requireActual("soap");
  return {
    __esModule: true,
    ...originalSoapModule,
    createClientAsync: jest.fn((urlWsd: string) => Promise.resolve({}))
  };
});

describe("Connect to a wsdl Aruba Client and verify signature ", () => {
  it("should connect to an imap server with the right credentials", async () => {
    const wsFunc = await ArubaVerify.createClientAruba(urlDemoAruba).run();
    expect(wsFunc.isRight()).toBeTruthy();
  });

  it("it should verify the attachment has signature ", async () => {
    const verify = await ArubaVerify.verify(emailAttachmentsMock).run();
    expect(verify).toBeDefined();
    expect(verify).not.toBe(emailAttachmentsMock);
  });
});

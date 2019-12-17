import { right } from "fp-ts/lib/Either";
import * as soap from "soap";
//import { WSDL } from "soap";
import { Client } from "soap";
import { urlDemoAruba } from "../../domain/data";
import * as ArubaVerify from "../../verify-sign/wsaruba";
import { IEmailAttachmentStatus, IAttachmentStatus } from "../../domain/models";
import { task } from "fp-ts/lib/Task";

/*
const ClientMock = ({
  VerifyPDFAsync: jest.fn(() => Promise.resolve(right({})))
} as unknown) as Client;

jest.mock("soap", () => {
  const originalSoapModule = jest.requireActual("soap");
  return {
    __esModule: true,
    ...originalSoapModule,
    Client: ClientMock,
    createClientAsync: jest.fn((urlWsd: string) => Promise.resolve({}))
    //WSDL: jest.fn()
    //createClientAsync: jest.fn((urlWsd: string) =>
    //Promise.resolve(new Client(new WSDL({}, urlWsd, {})))
    //)
  };
});
*/

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

console.log(emailAttachmentsWithStatusMock);

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

describe("Connect to a wsdl Aruba Client and verify signature ", () => {
  it("it should verify the attachment has signature ", async () => {
    const verify = await ArubaVerify.verify(emailAttachmentsMock).run();
    console.log(verify);
    expect(verify).toBeDefined();
    expect(verify).not.toBe(emailAttachmentsMock);
  });
});

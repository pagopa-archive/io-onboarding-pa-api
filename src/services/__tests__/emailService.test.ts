import * as nodemailer from "nodemailer";
import MockTransport = require("nodemailer-mock-transport");
import EmailService, { ITransporterOptions } from "../emailService";

describe("Email service", () => {
  const transporterOptions = {
    auth: {
      pass: "password",
      user: "user"
    },
    from: "sender@email.com",
    host: "smtp.host",
    port: 123,
    secure: true
  };

  describe("#send() with mock transport", () => {
    it("should return none after a successful email send", async () => {
      const validEmailOptions: nodemailer.SendMailOptions = {
        html: "Html content",
        subject: "Email subject",
        text: "Text content",
        to: "recipient@address.net"
      };
      const mockTransport = MockTransport(transporterOptions);
      const emailServiceInstance = new EmailService(
        (mockTransport as unknown) as ITransporterOptions
      );
      const sendingResult = await emailServiceInstance.send(validEmailOptions);
      expect(sendingResult.isNone()).toBeTruthy();
      expect(mockTransport.sentMail.length).toBe(1);
      const sentMail = mockTransport.sentMail[0];
      expect(sentMail.data.html).toBe(validEmailOptions.html);
      expect(sentMail.data.subject).toBe(validEmailOptions.subject);
      expect(sentMail.data.text).toBe(validEmailOptions.text);
      expect(sentMail.data.to).toBe(validEmailOptions.to);
    });

    it("should return an option error when the email send fails", async () => {
      const invalidEmailOptions = {} as nodemailer.SendMailOptions;
      const mockTransport = MockTransport(transporterOptions);
      const emailServiceInstance = new EmailService(
        (mockTransport as unknown) as ITransporterOptions
      );
      const sendingResult = await emailServiceInstance.send(
        invalidEmailOptions
      );
      expect(sendingResult.isSome()).toBeTruthy();
      expect(mockTransport.sentMail.length).toBe(0);
    });
  });

  describe("#verifyTransport", () => {
    it("should check if the connection has been established", async () => {
      const mockedVerify = jest.fn();
      jest.spyOn(nodemailer, "createTransport").mockImplementation(() => {
        return ({
          verify: mockedVerify
        } as unknown) as nodemailer.Transporter;
      });
      const testEmailAccount = await nodemailer.createTestAccount();
      const transporterConfig = {
        auth: {
          pass: testEmailAccount.pass,
          user: testEmailAccount.user
        },
        from: "sender@email.com",
        host: testEmailAccount.smtp.host,
        port: testEmailAccount.smtp.port,
        secure: testEmailAccount.smtp.secure
      };
      const emailService = new EmailService(transporterConfig);
      mockedVerify
        .mockImplementationOnce(() => Promise.resolve(true))
        .mockImplementationOnce(() => Promise.reject(new Error()));
      expect(emailService.verifyTransport()).resolves.toBe(true);
      return expect(emailService.verifyTransport()).rejects.not.toBeNull();
    });
  });
});

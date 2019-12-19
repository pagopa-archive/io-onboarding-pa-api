import { TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
import * as soap from "soap";
import { Client } from "soap";
import { urlDemoAruba } from "../domain/data";
import { IEmailAttachmentStatus } from "../domain/models";

// Create an async ARUBA client for veryfing signature
// URL https://vol.demo.firma-automatica.it/actalisVol/services/VerificationServiceSOAP?wsdl
export const createClientAruba = (
  urlWsd: string
): TaskEither<Error, Client> => {
  return tryCatch(
    () => soap.createClientAsync(urlWsd),
    reason => new Error(String(reason))
  );
};

// Connect to wsdl and call function VerifyPDFAsync
// for checking signature
// see doc https://doc.demo.firma-automatica.it/ doc aruba
const verifyAttachment = (
  client: Client,
  base64File: string
  // tslint:disable-next-line: readonly-array no-any
): TaskEither<Error, any[]> => {
  return tryCatch(
    () => {
      return client.VerifyPDFAsync({
        // For details about the parameters of VerifyPdf method of ARSS,
        // @see https://doc.demo.firma-automatica.it/manuali/manuale_vol.pdf
        fileContent: Buffer.from(base64File, "binary").toString("base64")
      });
    },
    reason => new Error(String(reason))
  );
};

// Connect to ARUBA client and verify status of signature
// for each attachment and build and update IEmailAttachmentStatus
// with status of attachments verified or not verified.
export const verify = (email: IEmailAttachmentStatus) => {
  return createClientAruba(urlDemoAruba)
    .chain(client => verifyAttachment(client, email.attachments[0].data))
    .fold(
      error => {
        throw new Error(String(error));
      },
      // tslint:disable-next-line: no-console
      value => {
        // array of objects
        // tslint:disable-next-line: no-console
        const info = value[0].return;
        const statusVerify = info.error === "OK" ? "OK" : "ERROR";

        return {
          ...email,
          attachments: [
            {
              ...email.attachments[0],
              attachmentStatus: {
                operation: "Verify PDF",
                status: statusVerify
              }
            }
          ]
        } as IEmailAttachmentStatus;
      }
    );
};

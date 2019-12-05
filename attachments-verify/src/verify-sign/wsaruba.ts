import { TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
import * as soap from "soap";
import { Client } from "soap";
import { urlDemoAruba } from "../domain/data";

// URL https://vol.demo.firma-automatica.it/actalisVol/services/VerificationServiceSOAP?wsdl

export const createClientAruba = (
  urlWsd: string
): TaskEither<Error, Client> => {
  return tryCatch(
    () => soap.createClientAsync(urlWsd),
    reason => new Error(String(reason))
  );
};

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

export const verify = (base64File: string) => {
  return createClientAruba(urlDemoAruba)
    .chain(client => verifyAttachment(client, base64File))
    .fold(
      error => {
        throw new Error(String(error));
      },
      // tslint:disable-next-line: no-console
      value => {
        // TODO extract a datastructure not console.log
        // array of objects
        // tslint:disable-next-line: no-console
        console.log(value.length);
        // tslint:disable-next-line: no-console
        console.log(value);
      }
    );
};

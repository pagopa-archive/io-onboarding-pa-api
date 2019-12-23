import { spawn } from "child_process";
import { Either, left, right } from "fp-ts/lib/Either";
import { TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
import * as fs from "fs";
import * as PdfDocument from "pdfkit";
import * as soap from "soap";
import * as tmp from "tmp";
import { getRequiredEnvVar } from "../utils/environment";

export default class DocumentService {
  constructor(private arssClient: soap.Client) {}

  public generateDocument(
    content: string,
    documentPath: string
  ): TaskEither<Error, undefined> {
    return tryCatch(
      () => {
        return new Promise((resolve, reject) => {
          tmp.file(
            { discardDescriptor: true },
            (tempFileError, tempFilePath, ___, removeCallback) => {
              if (tempFileError) {
                return reject(
                  new Error(
                    "An error occurred during temporary file generation"
                  )
                );
              }
              // TODO: add the id of the related request to the document metadata
              // @see:
              // - https://www.pivotaltracker.com/story/show/170101233
              // - https://www.pivotaltracker.com/story/show/170098805
              const contract = new PdfDocument();
              contract.text(content);
              const stream = contract.pipe(fs.createWriteStream(tempFilePath));
              contract.end();
              stream.on("error", error => {
                removeCallback();
                reject(error);
              });
              stream.on("finish", () =>
                this.convertToPdfA(tempFilePath, documentPath)
                  .fold(reject, resolve)
                  .map(_ => {
                    removeCallback();
                  })
                  .run()
              );
            }
          );
        });
      },
      error => error as Error
    );
  }

  public async signDocument(
    unsignedContentBase64: string
  ): Promise<Either<Error, string>> {
    try {
      const result = await this.arssClient.pdfsignatureV2Async({
        // For details about the parameters of pdfsignatureV2 method of ARSS,
        // @see https://doc.demo.firma-automatica.it/manuali/manuale_arss.pdf
        SignRequestV2: {
          certID: "AS0", // Reserved by Aruba for future use, its value must be currently set to `AS0`
          identity: {
            otpPwd: getRequiredEnvVar("ARSS_IDENTITY_OTP_PWD"),
            typeOtpAuth: getRequiredEnvVar("ARSS_IDENTITY_TYPE_OTP_AUTH"),
            user: getRequiredEnvVar("ARSS_IDENTITY_USER"),
            userPWD: getRequiredEnvVar("ARSS_IDENTITY_USER_PWD")
          },
          requiredmark: false,
          stream: unsignedContentBase64,
          transport: "STREAM"
        }
      });
      const responseContent = result[0].return;
      return responseContent.status === "OK"
        ? right(responseContent.stream as string)
        : left(new Error(result.description));
    } catch (error) {
      return left(error);
    }
  }

  private convertToPdfA(
    input: string,
    output: string
  ): TaskEither<Error, undefined> {
    const gsCommandArgs: ReadonlyArray<string> = [
      "-dQUIET",
      "-dPDFA=1",
      "-dBATCH",
      "-dNOPAUSE",
      "-sDEVICE=pdfwrite",
      "-sProcessColorModel=DeviceRGB",
      "-sColorConversionStrategy=UseDeviceIndependentColor",
      `-sOutputFile=${output}`,
      `${input}`
    ];
    return tryCatch<Error, undefined>(
      () =>
        new Promise((resolve, reject) => {
          const conversionProcess = spawn("gs", gsCommandArgs);
          // tslint:disable-next-line:readonly-array
          const logs: string[] = [];
          conversionProcess.stdout.on("data", data => {
            logs.push(data.toString());
          });
          conversionProcess.stderr.on("data", data => {
            logs.push(data.toString());
          });
          conversionProcess.on("close", code => {
            return code === 0 ? resolve() : reject(Error(logs.join(" / ")));
          });
        }).then(),
      error => error as Error
    );
  }
}

import { spawn } from "child_process";
import { left, right } from "fp-ts/lib/Either";
import { Task } from "fp-ts/lib/Task";
import { fromPredicate, TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
import * as fs from "fs";
import * as PdfDocument from "pdfkit";
import * as soap from "soap";
import * as tmp from "tmp";
import { getRequiredEnvVar } from "../utils/environment";

export default class DocumentService {
  constructor(private arssClient: soap.Client) {}

  public generateDocument(
    requestId: string,
    content: string,
    documentPath: string
  ): TaskEither<Error, undefined> {
    return new TaskEither(
      new Task(() => {
        return new Promise(resolve => {
          tmp.file(
            { discardDescriptor: true },
            (tempFileError, tempFilePath, ___, removeCallback) => {
              if (tempFileError) {
                return resolve(
                  left(
                    new Error(
                      "An error occurred during temporary file generation"
                    )
                  )
                );
              }
              const contract = new PdfDocument({ info: { Title: requestId } });
              contract.text(content);
              const stream = contract.pipe(fs.createWriteStream(tempFilePath));
              contract.end();
              stream.on("error", error => {
                removeCallback();
                resolve(left(error));
              });
              stream.on("finish", () =>
                this.convertToPdfA(tempFilePath, documentPath)
                  .fold(
                    error => resolve(left(error)),
                    () => resolve(right(undefined))
                  )
                  .map(_ => {
                    removeCallback();
                  })
                  .run()
              );
            }
          );
        });
      })
    );
  }

  public signDocument(
    unsignedContentBase64: string
  ): TaskEither<Error, string> {
    interface IPdfsignatureV2SuccessOutput {
      return_code: "0000";
      status: "OK";
      stream: string;
    }
    interface IPdfsignatureV2ErrorOutput {
      return_code: string;
      status: string;
      description: string;
    }
    function isIPdfsignatureV2SuccessOutput(
      output: PdfsignatureV2Output
    ): output is IPdfsignatureV2SuccessOutput {
      return output.status === "OK";
    }
    type PdfsignatureV2Output =
      | IPdfsignatureV2SuccessOutput
      | IPdfsignatureV2ErrorOutput;
    type pdfsignatureV2AsyncReturnValue = readonly [
      { return: PdfsignatureV2Output },
      string,
      undefined,
      string
    ];
    return tryCatch<Error, pdfsignatureV2AsyncReturnValue>(
      () =>
        // For details about the return value of the ARSS client method invocation,
        // @see: https://github.com/vpulim/node-soap#clientmethodasyncargs---call-method-on-the-soap-service
        this.arssClient.pdfsignatureV2Async({
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
        }),
      error => error as Error
    )
      .map(result => result[0].return)
      .chain(
        fromPredicate(
          isIPdfsignatureV2SuccessOutput,
          _ => new Error((_ as IPdfsignatureV2ErrorOutput).description)
        )
      )
      .map(responseContent => responseContent.stream);
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
    return new TaskEither(
      new Task(
        () =>
          new Promise(resolve => {
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
              return code === 0
                ? resolve(right(undefined))
                : resolve(left(Error(logs.join(" / "))));
            });
          })
      )
    );
  }
}

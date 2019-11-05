import { spawn } from "child_process";
import { none, Option, some } from "fp-ts/lib/Option";
import * as fs from "fs";
import * as PdfDocument from "pdfkit";
import { log } from "../utils/logger";

export default class DocumentService {
  public async generateDocument(
    content: string,
    documentPath: string
  ): Promise<Option<Error>> {
    return new Promise(resolve => {
      const tempFilePath = `${process.hrtime().join("")}.pdf`;
      const contract = new PdfDocument();
      contract.text(content);
      const stream = contract.pipe(fs.createWriteStream(tempFilePath));
      contract.end();
      stream.on("error", error => {
        resolve(some(error));
      });
      stream.on("finish", async () => {
        resolve(await this.convertToPdfA(tempFilePath, documentPath));
        fs.unlink(tempFilePath, err => {
          if (err) {
            log.error(
              "Error attempting to delete temp file %s. %s",
              tempFilePath,
              err
            );
          }
        });
      });
    });
  }

  private convertToPdfA(input: string, output: string): Promise<Option<Error>> {
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
    return new Promise(resolve => {
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
        resolve(code === 0 ? none : some(Error(logs.join(" / "))));
      });
    });
  }
}

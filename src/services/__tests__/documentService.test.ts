import { isLeft, isRight, left } from "fp-ts/lib/Either";
import { fromEither } from "fp-ts/lib/TaskEither";
import * as fs from "fs";
import * as soap from "soap";
import { getRequiredEnvVar } from "../../utils/environment";
import DocumentService from "../documentService";

async function getDocumentService(): Promise<DocumentService> {
  return new DocumentService(
    await soap.createClientAsync(getRequiredEnvVar("ARSS_WSDL_URL"))
  );
}

const validOutputPath = `${process.hrtime().join("")}.pdf`;

describe("DocumentService", () => {
  describe("#generateDocument()", () => {
    it("should return a right task with undefined if the document generation succeeds", done => {
      getDocumentService()
        .then(documentService =>
          documentService
            .generateDocument("request-id", "IO contract", validOutputPath)
            .run()
            .then(result => {
              expect(isRight(result)).toBeTruthy();
              fs.access(validOutputPath, error => {
                expect(error).toBeNull();
                expect(error).toBeDefined();
                fs.unlink(validOutputPath, done);
              });
              done();
            })
        )
        .catch(done.fail);
    });

    it("should return a left task with an error if the document generation fails", async () => {
      const mockConvertToPdfA = jest
        .spyOn(
          (DocumentService.prototype as unknown) as { convertToPdfA: () => {} },
          "convertToPdfA"
        )
        .mockReturnValue(fromEither(left(new Error("Error"))));
      const documentService = await getDocumentService();
      const result = await documentService
        .generateDocument("request-id", "IO contract", validOutputPath)
        .run();
      mockConvertToPdfA.mockRestore();
      expect(isLeft(result)).toBeTruthy();
      return fs.access(validOutputPath, error => {
        expect(error).not.toBeNull();
      });
    });
  });
});

describe("DocumentService#signDocument()", () => {
  it("should resolve with a right string if the signing succeeds", async () => {
    const base64string = await fs.promises.readFile(
      "./src/__mocks__/mockUnsignedFile.pdf",
      "base64"
    );
    const documentService = await getDocumentService();
    const result = await documentService.signDocument(base64string).run();
    expect(isRight(result)).toBeTruthy();
  });

  it("should reject with a left error if the signing fails", async () => {
    const documentService = await getDocumentService();
    const result = await documentService.signDocument("").run();
    expect(isLeft(result)).toBeTruthy();
  });
});

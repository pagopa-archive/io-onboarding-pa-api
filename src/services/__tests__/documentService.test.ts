import { isLeft, isRight } from "fp-ts/lib/Either";
import { isSome, none, some } from "fp-ts/lib/Option";
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
    it("returns a promise of none if the document generation succeeds", done => {
      getDocumentService()
        .then(documentService =>
          documentService
            .generateDocument("IO contract", validOutputPath)
            .then(result => {
              expect(result).toEqual(none);
              fs.access(validOutputPath, error => {
                expect(error).toBeNull();
                expect(error).toBeDefined();
                fs.unlink(validOutputPath, done);
              });
            })
            .catch(() => {
              done.fail(
                new Error("Document generation promise rejected unexpectedly")
              );
            })
        )
        .catch(done.fail);
    });

    it("returns a promise of some error if the document generation fails", async () => {
      const mockConvertToPdfA = jest
        .spyOn(
          (DocumentService.prototype as unknown) as { convertToPdfA: () => {} },
          "convertToPdfA"
        )
        .mockReturnValue(Promise.resolve(some(new Error("Error"))));
      const documentService = await getDocumentService();
      const result = await documentService.generateDocument(
        "IO contract",
        validOutputPath
      );
      mockConvertToPdfA.mockRestore();
      expect(isSome(result)).toBeTruthy();
      return fs.access(validOutputPath, error => {
        expect(error).not.toBeNull();
      });
    });
  });
});

describe("DocumentService#signDocument()", () => {
  it("should return a right string if the signing succeeds", async () => {
    const base64string = await fs.promises.readFile(
      "./src/__mocks__/mockUnsignedFile.pdf",
      "base64"
    );
    const documentService = await getDocumentService();
    const result = await documentService.signDocument(base64string);
    expect(isRight(result)).toBeTruthy();
  });

  it("should return a left error if the signing fails", async () => {
    const documentService = await getDocumentService();
    const result = await documentService.signDocument("");
    expect(isLeft(result)).toBeTruthy();
  });
});

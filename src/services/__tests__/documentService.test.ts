import { isSome, none, some } from "fp-ts/lib/Option";
import * as fs from "fs";
import DocumentService from "../documentService";

const documentService = new DocumentService();

const validOutputPath = `${process.hrtime().join("")}.pdf`;

describe("DocumentService", () => {
  describe("#generateDocument()", () => {
    it("returns a promise of none if the document generation succeeds", done => {
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
        });
    });

    it("returns a promise of some error if the document generation fails", async () => {
      const mockConvertToPdfA = jest
        .spyOn(
          (DocumentService.prototype as unknown) as { convertToPdfA: () => {} },
          "convertToPdfA"
        )
        .mockReturnValue(Promise.resolve(some(new Error("Error"))));
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

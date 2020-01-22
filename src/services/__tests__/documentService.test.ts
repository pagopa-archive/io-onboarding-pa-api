import { isLeft, isRight, left } from "fp-ts/lib/Either";
import { fromEither } from "fp-ts/lib/TaskEither";
import * as fs from "fs";
import * as nock from "nock";
import * as soap from "soap";
import {
  FAILURE_RESPONSE,
  SUCCESS_RESPONSE,
  WSDL,
  XSD
} from "../../__mocks__/arss";
import DocumentService from "../documentService";

const MOCK_ARSS_HOST = "https://arss.demo.firma-automatica.it";
const MOCK_ARSS_WSDL_PATH = "/ArubaSignService/ArubaSignService?wsdl";
const MOCK_ARSS_XSD_PATH = "/ArubaSignService/ArubaSignService?xsd=1";
const MOCK_ARSS_PATH = "/ArubaSignService/ArubaSignService";

nock(MOCK_ARSS_HOST)
  .get(MOCK_ARSS_WSDL_PATH)
  .reply(200, WSDL)
  .persist(true)
  .get(MOCK_ARSS_XSD_PATH)
  .reply(200, XSD)
  .persist(true);

async function getDocumentService(): Promise<DocumentService> {
  return new DocumentService(
    await soap.createClientAsync(MOCK_ARSS_HOST + MOCK_ARSS_WSDL_PATH)
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
    nock(MOCK_ARSS_HOST)
      .post(MOCK_ARSS_PATH)
      .reply(200, SUCCESS_RESPONSE);
    const base64string = await fs.promises.readFile(
      "./src/__mocks__/mockUnsignedFile.pdf",
      "base64"
    );
    const documentService = await getDocumentService();
    const result = await documentService.signDocument(base64string).run();
    expect(isRight(result)).toBeTruthy();
  });

  it("should reject with a left error if the signing fails", async () => {
    nock(MOCK_ARSS_HOST)
      .post(MOCK_ARSS_PATH)
      .reply(200, FAILURE_RESPONSE);
    const documentService = await getDocumentService();
    const result = await documentService.signDocument("").run();
    expect(isLeft(result)).toBeTruthy();
  });
});

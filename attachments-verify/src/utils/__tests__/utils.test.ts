import { task } from "fp-ts/lib/Task";
import { taskEither } from "fp-ts/lib/TaskEither";
import { emailAttachmentsWithStatusMock } from "../../___mocks__/mocks";
import * as U from "../utils";

jest.mock("../utils", () => {
  const originalIndex = jest.requireActual("../utils");
  return {
    __esModule: true,
    ...originalIndex,
    verifyAllAttachments: taskEither.of(task.of(emailAttachmentsWithStatusMock))
  };
});

describe("Connect to imap (email) server and verify attachments signature", () => {
  it("should return emails and attachments status", async () => {
    const verifyAll = await U.verifyAllAttachments.run();
    expect(verifyAll.isRight()).toBeTruthy();
  });
});

import { deleteDoc } from "../src/delete_doc.js";
import { reindexDocs } from "../src/index.js";
import { promises as fs } from "fs";
import path from "path";

jest.mock("../src/index", () => ({
  reindexDocs: jest.fn(),
}));

const TEST_FILE_NAME = "delete-test.md";
const TEST_FILE_PATH = path.join("ai_docs", TEST_FILE_NAME);
const TEST_CONTENT = "This is a test for delete doc.";

describe("deleteDoc", () => {
  beforeEach(async () => {
    await fs.writeFile(TEST_FILE_PATH, TEST_CONTENT);
  });

  afterEach(async () => {
    try {
      await fs.unlink(TEST_FILE_PATH);
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  });

  it("should delete an existing documentation file", async () => {
    await deleteDoc(TEST_FILE_NAME);
    const exists = await fs
      .access(TEST_FILE_PATH)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });

  it("should call reindexDocs after deleting the file", async () => {
    await deleteDoc(TEST_FILE_NAME);
    expect(reindexDocs).toHaveBeenCalled();
  });
});

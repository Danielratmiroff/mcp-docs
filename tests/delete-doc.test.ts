import { deleteDoc } from "../src/tools/delete_doc.ts";
import { generateIndex } from "../src/tools/generate_index.ts";
import { promises as fs } from "fs";
import path from "path";
import { fileExists } from "../src/utils.ts";

jest.mock("../src/tools/generate_index.ts", () => ({
  generateIndex: jest.fn(),
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
    const exists = await fileExists(TEST_FILE_PATH);
    expect(exists).toBe(false);
  });

  it("should call generateIndex after deleting the file", async () => {
    await deleteDoc(TEST_FILE_NAME);
    expect(generateIndex).toHaveBeenCalled();
  });
});

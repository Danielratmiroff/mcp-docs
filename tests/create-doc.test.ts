import { createDoc } from "../src/tools/create_doc";
import { generateIndex } from "../src/tools/generate_index";
import { promises as fs } from "fs";
import path from "path";

jest.mock("../src/tools/generate_index", () => ({
  generateIndex: jest.fn(),
}));

const TEST_FILE_NAME = "test-doc.md";
const TEST_FILE_PATH = path.join("ai_docs", TEST_FILE_NAME);
const TEST_CONTENT = "This is a test document.";

describe("createDoc", () => {
  afterEach(async () => {
    try {
      await fs.unlink(TEST_FILE_PATH);
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  });

  it("should create a new documentation file", async () => {
    await createDoc(TEST_FILE_NAME, TEST_CONTENT);

    const content = await fs.readFile(TEST_FILE_PATH, "utf-8");
    expect(content).toBe(TEST_CONTENT);
  });

  it("should add .md extension if not provided", async () => {
    await createDoc("test-doc", TEST_CONTENT);

    const content = await fs.readFile(TEST_FILE_PATH, "utf-8");
    expect(content).toBe(TEST_CONTENT);
  });

  it("should call reindexDocs after creating the file", async () => {
    await createDoc(TEST_FILE_NAME, TEST_CONTENT);

    expect(generateIndex).toHaveBeenCalled();
  });
});

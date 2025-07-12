import { strict as assert } from "assert";
import * as fs from "fs/promises";
import * as path from "path";
import { generateIndex, getFileHash } from "../src/tools/generate_index";
import { AI_DOCS_DIR_NAME, EMBEDDINGS_PATH } from "../src/config";

jest.mock("fs/promises");
jest.mock("@xenova/transformers", () => ({
  pipeline: jest.fn().mockResolvedValue(async (content: string | string[]) => {
    if (Array.isArray(content)) {
      return { tolist: () => content.map((_, i) => [i + 1]) };
    }
    return { tolist: () => [[1]] };
  }),
}));

const PROJECT_ROOT = ".";
const aiFolderPath = path.join(PROJECT_ROOT, AI_DOCS_DIR_NAME);
const embeddingsPath = path.join(PROJECT_ROOT, EMBEDDINGS_PATH);
const outputInfo = `Documentation path: ${aiFolderPath}\nEmbeddings path: ${embeddingsPath}`;

describe("generate-index", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mocks
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.readFile as jest.Mock).mockImplementation(async (filePath) => {
      const fPath = filePath.toString();
      if (fPath.endsWith(EMBEDDINGS_PATH)) {
        return JSON.stringify([]);
      }
      if (fPath.includes(AI_DOCS_DIR_NAME)) {
        return "";
      }
      throw new Error(`ENOENT: no such file or directory, open '${fPath}'`);
    });
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.rename as jest.Mock).mockResolvedValue(undefined);
    (fs.readdir as jest.Mock).mockResolvedValue([]);
  });

  it("should handle no changes", async () => {
    const existingContent = "existing content";
    const existingHash = getFileHash(existingContent);
    const docPath = path.join(PROJECT_ROOT, AI_DOCS_DIR_NAME, "existing.md");

    (fs.readdir as jest.Mock).mockResolvedValue(["existing.md"]);
    (fs.readFile as jest.Mock).mockImplementation(async (filePath) => {
      const fPath = filePath.toString();
      if (fPath.endsWith(EMBEDDINGS_PATH)) {
        return JSON.stringify([{ path: docPath, hash: existingHash, embedding: [1] }]);
      }
      if (fPath.endsWith(docPath)) {
        return existingContent;
      }
      throw new Error(`ENOENT: no such file or directory, open '${fPath}'`);
    });

    const result = await generateIndex(PROJECT_ROOT);
    assert.strictEqual(result, `No changes detected in documentation.\n${outputInfo}`);
  });

  it("should handle adding a new file", async () => {
    const newContent = "new content";
    const docPath = path.join(PROJECT_ROOT, AI_DOCS_DIR_NAME, "new.md");

    (fs.readdir as jest.Mock).mockResolvedValue(["new.md"]);
    (fs.readFile as jest.Mock).mockImplementation(async (filePath) => {
      const fPath = filePath.toString();
      if (fPath.endsWith(EMBEDDINGS_PATH)) {
        return JSON.stringify([]);
      }
      if (fPath.endsWith(docPath)) {
        return newContent;
      }
      throw new Error(`ENOENT: no such file or directory, open '${fPath}'`);
    });

    const result = await generateIndex(PROJECT_ROOT);
    assert.strictEqual(result, `Successfully indexed 1 new, 0 modified, and removed 0 deleted document(s).\n${outputInfo}`);
    // Check if writeFile was called with correct data
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining(EMBEDDINGS_PATH + ".tmp"),
      JSON.stringify([{ path: docPath, embedding: [1], hash: getFileHash(newContent) }])
    );
  });

  it("should handle deleting a file", async () => {
    const docPath = path.join(PROJECT_ROOT, AI_DOCS_DIR_NAME, "existing.md");
    (fs.readFile as jest.Mock).mockImplementation(async (filePath) => {
      const fPath = filePath.toString();
      if (fPath.endsWith(EMBEDDINGS_PATH)) {
        return JSON.stringify([{ path: docPath, hash: "somehash", embedding: [1, 2, 3] }]);
      }
      return "";
    });
    (fs.readdir as jest.Mock).mockResolvedValue([]); // Now it's gone

    const result = await generateIndex(PROJECT_ROOT);
    assert.strictEqual(result, `Successfully indexed 0 new, 0 modified, and removed 1 deleted document(s).\n${outputInfo}`);
    // Check if writeFile was called with empty data
    expect(fs.writeFile).toHaveBeenCalledWith(expect.stringContaining(EMBEDDINGS_PATH + ".tmp"), JSON.stringify([]));
  });

  it("should handle modifying a file", async () => {
    const modifiedContent = "modified content";
    const newHash = getFileHash(modifiedContent);
    const docPath = path.join(PROJECT_ROOT, AI_DOCS_DIR_NAME, "modified.md");

    (fs.readdir as jest.Mock).mockResolvedValue(["modified.md"]);
    (fs.readFile as jest.Mock).mockImplementation(async (filePath) => {
      const fPath = filePath.toString();
      if (fPath.endsWith(EMBEDDINGS_PATH)) {
        return JSON.stringify([{ path: docPath, hash: "oldhash", embedding: [1, 2, 3] }]);
      }
      if (fPath.endsWith(docPath)) {
        return modifiedContent;
      }
      throw new Error(`ENOENT: no such file or directory, open '${fPath}'`);
    });

    const result = await generateIndex(PROJECT_ROOT);
    assert.strictEqual(result, `Successfully indexed 0 new, 1 modified, and removed 0 deleted document(s).\n${outputInfo}`);
    // Check if writeFile was called with updated data
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining(EMBEDDINGS_PATH + ".tmp"),
      JSON.stringify([{ path: docPath, embedding: [1], hash: newHash }])
    );
  });

  it("should handle a mix of additions, modifications, and deletions", async () => {
    const existingContent = "existing content";
    const existingHash = getFileHash(existingContent);
    const existingPath = path.join(PROJECT_ROOT, AI_DOCS_DIR_NAME, "existing.md");

    const modifiedContent = "modified content";
    const modifiedNewHash = getFileHash(modifiedContent);
    const modifiedPath = path.join(PROJECT_ROOT, AI_DOCS_DIR_NAME, "modified.md");

    const deletedPath = path.join(PROJECT_ROOT, AI_DOCS_DIR_NAME, "deleted.md");

    const newContent = "new content";
    const newPath = path.join(PROJECT_ROOT, AI_DOCS_DIR_NAME, "new.md");

    // Initial state in embeddings.json
    (fs.readFile as jest.Mock).mockImplementation(async (filePath) => {
      const fPath = filePath.toString();
      if (fPath.endsWith(EMBEDDINGS_PATH)) {
        return JSON.stringify([
          { path: existingPath, hash: existingHash, embedding: [1] }, // unchanged
          { path: modifiedPath, hash: "oldhash", embedding: [2] }, // modified
          { path: deletedPath, hash: "somehash", embedding: [3] }, // deleted
        ]);
      }
      if (fPath.endsWith(existingPath)) return existingContent;
      if (fPath.endsWith(modifiedPath)) return modifiedContent;
      if (fPath.endsWith(newPath)) return newContent;
      throw new Error(`ENOENT: no such file or directory, open '${fPath}'`);
    });

    // State of the directory
    (fs.readdir as jest.Mock).mockResolvedValue(["existing.md", "modified.md", "new.md"]);

    const result = await generateIndex(PROJECT_ROOT);
    assert.strictEqual(result, `Successfully indexed 1 new, 1 modified, and removed 1 deleted document(s).\n${outputInfo}`);

    // Check the final state written to the file
    const expectedData = [
      { path: existingPath, hash: existingHash, embedding: [1] },
      { path: modifiedPath, embedding: [1], hash: modifiedNewHash },
      { path: newPath, embedding: [2], hash: getFileHash(newContent) },
    ].sort((a, b) => a.path.localeCompare(b.path));

    const writeFileCall = (fs.writeFile as jest.Mock).mock.calls[0];
    const actualData = JSON.parse(writeFileCall[1]).sort((a: { path: string }, b: { path: string }) => a.path.localeCompare(b.path));

    expect(writeFileCall[0]).toContain(EMBEDDINGS_PATH + ".tmp");
    expect(actualData).toEqual(expectedData);
  });
});

import * as fs from "fs/promises";
import * as path from "path";
import {
  createCursorRule,
  createDataFolder,
  createDocumentationFolder,
  createEmbeddingsFile,
  createGeminiRule,
} from "../src/ai_rules";
import {
  AI_DOCS_MCP_DESCRIPTION,
  CONTEXTO_GEMINI_FILE_NAME,
  CURSOR_RULES_FILE_NAME,
  DATA_DIR_NAME,
  EMBEDDINGS_PATH,
  AI_DOCS_DIR_NAME,
  CURSOR_DIR_NAME,
  CURSOR_RULES_DIR_NAME,
  GEMINI_DIR_NAME,
  GEMINI_SETTINGS_FILE_NAME,
  GEMINI_CONTEXT_FILE_NAME,
} from "../src/config";
import { createDirectory, createFile, fileExists } from "../src/utils";

jest.mock("fs/promises");
jest.mock("../src/utils");

const mockedFileExists = fileExists as jest.Mock;
const mockedCreateDirectory = createDirectory as jest.Mock;
const mockedCreateFile = createFile as jest.Mock;
const mockedFsReadFile = fs.readFile as jest.Mock;
const mockedFsWriteFile = fs.writeFile as jest.Mock;

const projectRoot = path.join(__dirname, "..");

describe("AI Rules", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createDataFolder", () => {
    it("should call createDirectory with the correct data folder path", async () => {
      const dataDir = path.join(projectRoot, DATA_DIR_NAME);
      const result = await createDataFolder(projectRoot);
      expect(mockedCreateDirectory).toHaveBeenCalledWith(dataDir);
      expect(result).toBe(`Successfully created ${dataDir}`);
    });
  });

  describe("createDocumentationFolder", () => {
    it("should call createDirectory with the correct docs folder path", async () => {
      const aiDocsDir = path.join(projectRoot, AI_DOCS_DIR_NAME);
      const result = await createDocumentationFolder(projectRoot);
      expect(mockedCreateDirectory).toHaveBeenCalledWith(aiDocsDir);
      expect(result).toBe(`Successfully created ${aiDocsDir}`);
    });
  });

  describe("createEmbeddingsFile", () => {
    it("should call createFile with the correct embeddings file path", async () => {
      const embeddingsPath = path.join(projectRoot, EMBEDDINGS_PATH);
      const result = await createEmbeddingsFile(projectRoot);
      expect(mockedCreateFile).toHaveBeenCalledWith(embeddingsPath, "[]");
      expect(result).toBe(`Successfully created ${embeddingsPath}`);
    });
  });

  describe("createCursorRule", () => {
    it("should create the .cursor/rules directory and the rule file", async () => {
      const rulesDir = path.join(projectRoot, CURSOR_DIR_NAME, CURSOR_RULES_DIR_NAME);
      const ruleFilePath = path.join(rulesDir, CURSOR_RULES_FILE_NAME);
      const expectedContent = `---
alwaysApply: true
---
${AI_DOCS_MCP_DESCRIPTION}`;

      const result = await createCursorRule(projectRoot);

      expect(mockedCreateDirectory).toHaveBeenCalledWith(rulesDir);
      expect(mockedCreateFile).toHaveBeenCalledWith(ruleFilePath, expectedContent);
      expect(result).toBe(`Successfully created ${ruleFilePath}`);
    });
  });

  describe("createGeminiRule", () => {
    const geminiDir = path.join(projectRoot, GEMINI_DIR_NAME);
    const settingsPath = path.join(geminiDir, GEMINI_SETTINGS_FILE_NAME);
    const ruleFilePath = path.join(projectRoot, CONTEXTO_GEMINI_FILE_NAME);

    describe("when settings.json does not exist", () => {
      it("should create .gemini dir, settings.json with defaults, and CONTEXTO_GEMINI.md", async () => {
        mockedFileExists.mockResolvedValue(false);

        const defaultSettings = {
          contextFileName: [GEMINI_CONTEXT_FILE_NAME, CONTEXTO_GEMINI_FILE_NAME],
        };

        const result = await createGeminiRule(projectRoot);

        expect(mockedCreateDirectory).toHaveBeenCalledWith(geminiDir);
        expect(mockedFileExists).toHaveBeenCalledWith(settingsPath);
        expect(mockedCreateFile).toHaveBeenCalledWith(
          settingsPath,
          JSON.stringify(defaultSettings, null, 2)
        );
        expect(mockedCreateFile).toHaveBeenCalledWith(ruleFilePath, AI_DOCS_MCP_DESCRIPTION);
        expect(result).toBe(`Successfully created ${ruleFilePath}`);
        expect(mockedFsReadFile).not.toHaveBeenCalled();
        expect(mockedFsWriteFile).not.toHaveBeenCalled();
      });
    });

    describe("when settings.json exists", () => {
      it("should update settings.json if it has no contextFileName", async () => {
        mockedFileExists.mockResolvedValue(true);
        mockedFsReadFile.mockResolvedValue(JSON.stringify({}));

        const expectedConfig = {
          contextFileName: [CONTEXTO_GEMINI_FILE_NAME],
        };

        await createGeminiRule(projectRoot);

        expect(mockedCreateDirectory).toHaveBeenCalledWith(geminiDir);
        expect(mockedFsReadFile).toHaveBeenCalledWith(settingsPath, "utf-8");
        expect(mockedFsWriteFile).toHaveBeenCalledWith(
          settingsPath,
          JSON.stringify(expectedConfig, null, 2)
        );
        expect(mockedCreateFile).toHaveBeenCalledWith(ruleFilePath, AI_DOCS_MCP_DESCRIPTION);
      });

      it("should add to string contextFileName", async () => {
        mockedFileExists.mockResolvedValue(true);
        mockedFsReadFile.mockResolvedValue(JSON.stringify({ contextFileName: "file.md" }));

        const expectedConfig = {
          contextFileName: ["file.md", CONTEXTO_GEMINI_FILE_NAME],
        };

        await createGeminiRule(projectRoot);
        expect(mockedFsWriteFile).toHaveBeenCalledWith(
          settingsPath,
          JSON.stringify(expectedConfig, null, 2)
        );
      });

      it("should add to array contextFileName", async () => {
        mockedFileExists.mockResolvedValue(true);
        mockedFsReadFile.mockResolvedValue(JSON.stringify({ contextFileName: ["file.md"] }));

        const expectedConfig = {
          contextFileName: ["file.md", CONTEXTO_GEMINI_FILE_NAME],
        };

        await createGeminiRule(projectRoot);
        expect(mockedFsWriteFile).toHaveBeenCalledWith(
          settingsPath,
          JSON.stringify(expectedConfig, null, 2)
        );
      });

      it("should not add a duplicate", async () => {
        const initialConfig = {
          contextFileName: ["file.md", CONTEXTO_GEMINI_FILE_NAME],
        };
        mockedFileExists.mockResolvedValue(true);
        mockedFsReadFile.mockResolvedValue(JSON.stringify(initialConfig));

        await createGeminiRule(projectRoot);
        expect(mockedFsWriteFile).toHaveBeenCalledWith(
          settingsPath,
          JSON.stringify(initialConfig, null, 2)
        );
      });
    });
  });
});
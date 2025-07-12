import * as fs from "fs/promises";
import * as path from "path";
import { createCursorRule, createGeminiRule } from "../src/ai_rules";

jest.mock("fs/promises");

const AI_DOCS_MCP_DESCRIPTION = `
# CONTEXTO MCP

You MUST use the 'CONTEXTO' MCP TOOL KIT to retrieve the project's up-to-date documentation, best practices,
code examples, folder structure, project architecture,
and other relevant information that might be useful for fulfilling the user's request.

You should ALWAYS consult the 'CONTEXTO' MCP documentation when you are unsure or have a question about the project's architecture, best practices, or other relevant information.
`;

const projectRoot = path.join(__dirname, "..");

describe("AI Rules", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe("createCursorRule", () => {
    it("should create the .cursor/rules directory and the rule file", async () => {
      const rulesDir = path.join(projectRoot, ".cursor", "rules");
      const ruleFilePath = path.join(rulesDir, "mcp-contexto.mdc");
      const expectedContent = `---
alwaysApply: true
---
${AI_DOCS_MCP_DESCRIPTION}`;

      const result = await createCursorRule(projectRoot);

      // Verify directory creation
      expect(fs.mkdir).toHaveBeenCalledWith(rulesDir, { recursive: true });

      // Verify file creation with correct content
      expect(fs.writeFile).toHaveBeenCalledWith(ruleFilePath, expectedContent);

      // Verify success message
      expect(result).toBe(`Successfully created ${ruleFilePath}`);
    });
  });

  describe("createGeminiRule", () => {
    const geminiDir = path.join(projectRoot, ".gemini");
    const settingsPath = path.join(geminiDir, "settings.json");
    const ruleFilePath = path.join(projectRoot, "CONTEXTO_GEMINI.md");

    it("should create .gemini dir, settings.json, and CONTEXTO_GEMINI.md if none exist", async () => {
      // Mock fs.access to throw ENOENT, simulating file not found
      (fs.access as jest.Mock).mockRejectedValue({ code: "ENOENT" });

      const defaultSettings = {
        contextFileName: ["GEMINI.md", "CONTEXTO_GEMINI.md"],
      };

      const result = await createGeminiRule(projectRoot);

      // Verify directory creation
      expect(fs.mkdir).toHaveBeenCalledWith(geminiDir, { recursive: true });

      // Verify settings.json was created with default content
      expect(fs.writeFile).toHaveBeenCalledWith(settingsPath, JSON.stringify(defaultSettings, null, 2));

      // Verify the rule file was created with the correct description
      expect(fs.writeFile).toHaveBeenCalledWith(ruleFilePath, AI_DOCS_MCP_DESCRIPTION);

      // Verify success message
      expect(result).toBe(`Successfully created ${ruleFilePath}`);
    });

    it("should update settings.json if it exists but has no contextFileName", async () => {
      // Mock fs.access to resolve, simulating file exists
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      // Mock readFile to return an empty JSON object
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({}));

      const expectedConfig = {
        contextFileName: ["CONTEXTO_GEMINI.md"],
      };

      await createGeminiRule(projectRoot);

      expect(fs.readFile).toHaveBeenCalledWith(settingsPath, "utf-8");
      expect(fs.writeFile).toHaveBeenCalledWith(settingsPath, JSON.stringify(expectedConfig, null, 2));
    });

    it("should add CONTEXTO_GEMINI.md to an existing string contextFileName", async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ contextFileName: "some-file.md" }));

      const expectedConfig = {
        contextFileName: ["some-file.md", "CONTEXTO_GEMINI.md"],
      };

      await createGeminiRule(projectRoot);

      expect(fs.writeFile).toHaveBeenCalledWith(settingsPath, JSON.stringify(expectedConfig, null, 2));
    });

    it("should add CONTEXTO_GEMINI.md to an existing array contextFileName", async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ contextFileName: ["existing.md"] }));

      const expectedConfig = {
        contextFileName: ["existing.md", "CONTEXTO_GEMINI.md"],
      };

      await createGeminiRule(projectRoot);

      expect(fs.writeFile).toHaveBeenCalledWith(settingsPath, JSON.stringify(expectedConfig, null, 2));
    });

    it("should not add a duplicate if CONTEXTO_GEMINI.md already exists in the array", async () => {
      const initialConfig = {
        contextFileName: ["existing.md", "CONTEXTO_GEMINI.md"],
      };
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(initialConfig));

      await createGeminiRule(projectRoot);

      // The config should not be changed
      expect(fs.writeFile).toHaveBeenCalledWith(settingsPath, JSON.stringify(initialConfig, null, 2));
    });

    it("should throw an error if fs.access rejects with an error other than ENOENT", async () => {
      const someError = new Error("EACCES: permission denied");
      (fs.access as jest.Mock).mockRejectedValue(someError);

      await expect(createGeminiRule(projectRoot)).rejects.toThrow("EACCES: permission denied");
    });
  });
});

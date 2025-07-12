import * as fs from "fs/promises";
import * as path from "path";
import {
  AI_DOCS_DIR_NAME,
  AI_DOCS_MCP_DESCRIPTION,
  CONTEXTO_GEMINI_FILE_NAME,
  CURSOR_DIR_NAME,
  CURSOR_RULES_DIR_NAME,
  CURSOR_RULES_FILE_NAME,
  DATA_DIR_NAME,
  EMBEDDINGS_PATH,
  GEMINI_CONTEXT_FILE_NAME,
  GEMINI_DIR_NAME,
  GEMINI_SETTINGS_FILE_NAME,
} from "./config.js";
import { createDirectory, createFile, fileExists } from "./utils.js";

export async function createDataFolder(projectRoot: string): Promise<string> {
  const dataDir = path.join(projectRoot, DATA_DIR_NAME);
  await createDirectory(dataDir);
  return `Successfully created ${dataDir}`;
}

export async function createDocumentationFolder(projectRoot: string): Promise<string> {
  const aiDocsDir = path.join(projectRoot, AI_DOCS_DIR_NAME);
  await createDirectory(aiDocsDir);
  return `Successfully created ${aiDocsDir}`;
}

export async function createEmbeddingsFile(projectRoot: string): Promise<string> {
  const embeddingsPath = path.join(projectRoot, EMBEDDINGS_PATH);
  await createFile(embeddingsPath, "[]");
  return `Successfully created ${embeddingsPath}`;
}

/*
 * Cursor Rule to configure the MCP server.
 */
export async function createCursorRule(projectRoot: string): Promise<string> {
  const rulesDir = path.join(projectRoot, CURSOR_DIR_NAME, CURSOR_RULES_DIR_NAME);
  await createDirectory(rulesDir);
  const ruleFilePath = path.join(rulesDir, CURSOR_RULES_FILE_NAME);
  const cursorRuleContent = `---
alwaysApply: true
---
${AI_DOCS_MCP_DESCRIPTION}`;

  await createFile(ruleFilePath, cursorRuleContent);
  return `Successfully created ${ruleFilePath}`;
}

/*
 * Gemini Rule to configure the MCP server.
 * Add the AI_DOCS_GEMINI.md to the context file list
 */
export async function createGeminiRule(projectRoot: string): Promise<string> {
  // Create the .gemini directory if it doesn't exist
  const geminiDirPath = path.join(projectRoot, GEMINI_DIR_NAME);
  await createDirectory(geminiDirPath);

  // Create or update the settings.json file
  const settingsPath = path.join(geminiDirPath, GEMINI_SETTINGS_FILE_NAME);
  const defaultSettings = {
    contextFileName: [GEMINI_CONTEXT_FILE_NAME, CONTEXTO_GEMINI_FILE_NAME],
  };

  // Update the settings.json
  if (await fileExists(settingsPath)) {
    const existingContent = await fs.readFile(settingsPath, "utf-8");
    const config = JSON.parse(existingContent);
    const contFile = CONTEXTO_GEMINI_FILE_NAME;
    let entries: string[] = [];
    if (config.contextFileName) {
      const val = config.contextFileName;
      if (typeof val === "string") {
        entries = [val];
      } else if (Array.isArray(val)) {
        entries = val;
      }
    }
    if (!entries.includes(contFile)) {
      entries.push(contFile);
    }
    config.contextFileName = entries;
    await fs.writeFile(settingsPath, JSON.stringify(config, null, 2));
  } else {
    // File does not exist, create it with default settings
    await createFile(settingsPath, JSON.stringify(defaultSettings, null, 2));
  }

  // Create the CONTEXTO_GEMINI.md file
  const ruleFilePath = path.join(projectRoot, CONTEXTO_GEMINI_FILE_NAME);
  await createFile(ruleFilePath, AI_DOCS_MCP_DESCRIPTION);
  return `Successfully created ${ruleFilePath}`;
}

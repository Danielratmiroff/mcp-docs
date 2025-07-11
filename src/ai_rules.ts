import * as fs from "fs/promises";
import * as path from "path";
import { findProjectRoot } from "./utils.js";

export const AI_DOCS_MCP_DESCRIPTION = `
# CONTEXTO MCP

You MUST use the 'CONTEXTO' MCP TOOL KIT to retrieve the project's up-to-date documentation, best practices,
code examples, folder structure, project architecture,
and other relevant information that might be useful for fulfilling the user's request.

You should ALWAYS consult the 'CONTEXTO' MCP documentation when you are unsure or have a question about the project's architecture, best practices, or other relevant information.
`;

export async function createDataFolder(): Promise<string> {
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    throw new Error("Failed to find project root.");
  }
  const dataDir = path.join(projectRoot, "data");
  await fs.mkdir(dataDir, { recursive: true });
  return `Successfully created ${dataDir}`;
}

/*
 * Cursor Rule to configure the MCP server.
 */
export async function createCursorRule(): Promise<string> {
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    throw new Error("Failed to find project root.");
  }
  const rulesDir = path.join(projectRoot, ".cursor", "rules");
  await fs.mkdir(rulesDir, { recursive: true });
  const ruleFilePath = path.join(rulesDir, "mcp-contexto.mdc");
  const cursorRuleContent = `---
alwaysApply: true
---
${AI_DOCS_MCP_DESCRIPTION}`;

  await fs.writeFile(ruleFilePath, cursorRuleContent);
  return `Successfully created ${ruleFilePath}`;
}

/*
 * Gemini Rule to configure the MCP server.
 */
export async function createGeminiRule(): Promise<string> {
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    throw new Error("Failed to find project root.");
  }
  // Add AI_DOCS_GEMINI.md to the context file list
  const geminiDir = path.join(projectRoot, ".gemini");
  await fs.mkdir(geminiDir, { recursive: true });
  const settingsPath = path.join(geminiDir, "settings.json");
  const defaultSettings = {
    contextFileName: ["GEMINI.md", "CONTEXTO_GEMINI.md"],
  };

  try {
    await fs.access(settingsPath);
    const existingContent = await fs.readFile(settingsPath, "utf-8");
    const config = JSON.parse(existingContent);
    const contFile = "CONTEXTO_GEMINI.md";
    let entries: string[];
    if ("contextFileName" in config) {
      const val = config.contextFileName;
      if (typeof val === "string") {
        entries = [val];
      } else if (Array.isArray(val)) {
        entries = val;
      } else {
        entries = [];
      }
    } else {
      entries = [];
    }
    if (!entries.includes(contFile)) {
      entries.push(contFile);
    }
    config.contextFileName = entries;
    await fs.writeFile(settingsPath, JSON.stringify(config, null, 2));
  } catch (error) {
    // If file does not exist, create it with default settings
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      await fs.writeFile(settingsPath, JSON.stringify(defaultSettings, null, 2));
    } else {
      throw error;
    }
  }

  // Create the AI_DOCS_GEMINI.md file
  const ruleFilePath = path.join(projectRoot, "CONTEXTO_GEMINI.md");
  await fs.writeFile(ruleFilePath, AI_DOCS_MCP_DESCRIPTION);
  return `Successfully created ${ruleFilePath}`;
}

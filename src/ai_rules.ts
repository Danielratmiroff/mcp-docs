import * as fs from "fs/promises";
import * as path from "path";

const AI_DOCS_MCP_DESCRIPTION = `
# AI-DOCS MCP

MCP 'AI-DOCS' server is used to retrieve the project's up-to-date documentation, best practices, 
code examples, folder structure, project architecture, 
and other relevant information that might be useful for fulfilling the user's request.

You should consult the 'AI-DOCS' MCP documentation when you are unsure or have a question about the project's architecture, best practices, or other relevant information.
`;

/*
 * Cursor Rule to configure the MCP server.
 */
export async function createCursorRule(): Promise<string> {
  const rulesDir = path.join(process.cwd(), ".cursor", "rules");
  await fs.mkdir(rulesDir, { recursive: true });
  const ruleFilePath = path.join(rulesDir, "mcp-ai-docs.mdc");
  const cursorRuleContent = `---
alwaysApply: false
---
${AI_DOCS_MCP_DESCRIPTION}`;

  await fs.writeFile(ruleFilePath, cursorRuleContent);
  return `Successfully created ${ruleFilePath}`;
}

/*
 * Gemini Rule to configure the MCP server.
 */
export async function createGeminiRule(): Promise<string> {
  // Add AI_DOCS_GEMINI.md to the context file list
  const geminiDir = path.join(process.cwd(), ".gemini");
  await fs.mkdir(geminiDir);
  await fs.writeFile(
    path.join(geminiDir, "settings.json"),
    JSON.stringify(
      {
        contextFileName: ["GEMINI.md", "AI_DOCS_GEMINI.md"],
      },
      null,
      2
    )
  );

  // Create the AI_DOCS_GEMINI.md file
  const ruleFilePath = path.join(process.cwd(), "AI_DOCS_GEMINI.md");
  await fs.writeFile(ruleFilePath, AI_DOCS_MCP_DESCRIPTION);
  return `Successfully created ${ruleFilePath}`;
}

import { createDoc } from "./tools/create_doc.ts";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { similarity } from "ml-distance";
import { deleteDoc } from "./tools/delete_doc.ts";
import { computeEmbedding, loadSearchIndex, MIN_SIMILARITY_SCORE, generateIndex } from "./tools/generate_index.ts";
import { readDocumentationFile } from "./utils.ts";

const server = new McpServer({
  name: "ai-docs-server",
  version: "1.0.0",
  instructions: `Use this server to retrieve the project's up-to-date documentation, best practices, 
    code examples, folder structure, project architecture, 
    and other relevant information that might be useful for fulfilling the user's request.`,
});

async function search(query: string, topMatches = 5) {
  const embeddingData = await loadSearchIndex();
  if (embeddingData.length === 0) {
    return [];
  }

  const queryEmbedding = await computeEmbedding(query);
  const queryVector = queryEmbedding[0];

  const similarities = embeddingData.map((data) => similarity.cosine(queryVector, data.embedding));

  const rankedResults = embeddingData
    .map((data, index) => ({
      path: data.path,
      score: similarities[index],
    }))
    .sort((a, b) => b.score - a.score)
    .filter((result) => result.score > MIN_SIMILARITY_SCORE);

  return rankedResults.slice(0, topMatches);
}
// Register tool to search documentation
server.registerTool(
  "search-docs",
  {
    title: "Search AI Documentation",
    description: `You MUST call this function before 'read-doc' to obtain the correct filename for the documentation you need.
    Selection Process:
    1. Analyzes the user's query to understand the subject.
    2. Returns the most relevant document(s) based on semantic similarity.
    Response Format:
    - Returns a ranked list of matching documentation files as a JSON object.
    - Each entry includes the 'path' and a similarity 'score'.
    - If no matches are found, it will state this clearly.`,
    inputSchema: {
      query: z.string().describe("Free-text search query for semantic matching."),
    },
  },
  async ({ query }: { query: string }, _extra) => {
    const matches = await search(query);
    if (!matches.length) {
      return {
        content: [
          {
            type: "text",
            text: `${matches} No documentation found matching the query: '${query}'.`,
          },
        ],
      };
    }

    const jsonString = JSON.stringify(matches, null, 2);
    return {
      content: [
        {
          type: "text",
          text: jsonString,
        },
      ],
    };
  }
);

server.registerTool(
  "read-doc",
  {
    title: "Read AI Documentation File",
    description:
      "You MUST call 'search-docs' function tool first to obtain the correct filePath. Then, use this tool to read the content of a documentation file given its full path.",
    inputSchema: {
      filePath: z.string().describe("The full path of the file to read."),
    },
  },
  async ({ filePath }) => {
    const content = await readDocumentationFile(filePath);
    if (!content) {
      return {
        content: [
          {
            type: "text",
            text: `Could not read file: '${filePath}'.`,
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: content,
        },
      ],
    };
  }
);

server.registerTool(
  "delete-doc",
  {
    title: "Delete AI Documentation File",
    description:
      "Deletes a documentation file from the ai_docs folder and reindexes the embeddings so it is not accessible through other tools.",
    inputSchema: {
      fileName: z.string().describe("Name of the documentation file to delete (with or without .md extension)."),
    },
  },
  async ({ fileName }: { fileName: string }) => {
    try {
      await deleteDoc(fileName);
      return {
        content: [{ type: "text", text: `Deleted '${fileName}' and reindexed documentation.` }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error deleting file '${fileName}': ${error.message}` }],
      };
    }
  }
);

const AI_DOCS_MCP_DESCRIPTION = `MCP 'AI-DOCS' server is used to retrieve the project's up-to-date documentation, best practices, 
code examples, folder structure, project architecture, 
and other relevant information that might be useful for fulfilling the user's request.

You should consult the 'AI-DOCS' MCP documentation when you are unsure or have a question about the project's architecture, best practices, or other relevant information.`;

async function createCursorRule(): Promise<string> {
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

async function createOrUpdateGeminiRule(): Promise<string> {
  const geminiRuleTitle = "## AI Documentation MCP";
  const geminiFilePath = path.join(process.cwd(), "GEMINI.md");

  let geminiFileContent = "";
  try {
    geminiFileContent = await fs.readFile(geminiFilePath, "utf-8");
  } catch (error) {
    // File doesn't exist, which is fine
  }

  if (geminiFileContent.includes(geminiRuleTitle)) {
    return "GEMINI.md already contains the rule.";
  } else {
    const contentToAppend = (geminiFileContent ? "\n\n" : "") + `${geminiRuleTitle}\n${AI_DOCS_MCP_DESCRIPTION}`;
    await fs.appendFile(geminiFilePath, contentToAppend);
    return `Successfully updated ${geminiFilePath}`;
  }
}

server.registerTool(
  "init",
  {
    title: "Initialize MCP Server configuration",
    description: "Creates the necessary rule files for the MCP documentation search and the data files for the MCP server.",
    inputSchema: {},
  },
  async () => {
    const messages = await Promise.all([createCursorRule(), createOrUpdateGeminiRule()]);

    return {
      content: [
        {
          type: "text",
          text: messages.join("\n"),
        },
      ],
    };
  }
);

server.registerTool(
  "generate-index",
  {
    title: "Generate AI Documentation Index",
    description: "Generates or updates the search index for all documentation files.",
    inputSchema: {},
  },
  async () => {
    return await generateIndex();
  }
);

server.registerTool(
  "create-doc",
  {
    title: "Create AI Documentation File",
    description: "Creates a new documentation file and re-indexes the documentation.",
    inputSchema: {
      fileName: z.string().describe("The name of the file to create."),
      content: z.string().describe("The content of the file."),
    },
  },
  async ({ fileName, content }) => {
    await createDoc(fileName, content);
    return {
      content: [
        {
          type: "text",
          text: `Successfully created and indexed '${fileName}'.`,
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // console.error("AI Docs MCP Server running on stdio");
}

main().catch((error) => {
  // console.error("Fatal error in main():", error);
  process.exit(1);
});

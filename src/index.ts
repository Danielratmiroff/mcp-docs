import { createDoc } from "./create_doc.ts";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { pipeline } from "@xenova/transformers";
import { similarity } from "ml-distance";
import { createHash } from "crypto";
import { logToFile } from "./utils.ts";
import { fileHasSupportedExtension } from "./generate_embeddings.ts";
import { deleteDoc } from "./delete_doc.ts";

const server = new McpServer({
  name: "ai-docs-server",
  version: "1.0.0",
  instructions: `Use this server to retrieve the project's up-to-date documentation, best practices, 
    code examples, folder structure, project architecture, 
    and other relevant information that might be useful for fulfilling the user's request.`,
});

const MODEL_NAME = "Xenova/all-MiniLM-L6-v2"; // TODO: is there a better model?
const MIN_SIMILARITY_SCORE = 0.4;

export const AI_DOCS_DIR = path.join(process.cwd(), "ai_docs");
export const DATA_DIR = path.join(process.cwd(), "data");
export const EMBEDDINGS_PATH = path.join(DATA_DIR, "embeddings.json");

interface EmbeddingData {
  path: string;
  embedding: number[];
  hash: string;
}

async function fileExists(filePath: string): Promise<boolean> {
  return await fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);
}

async function loadJSON<T>(filePath: string): Promise<T> {
  if (!(await fileExists(filePath))) {
    return [] as T;
  }

  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data) as T;
  } catch (error) {
    logToFile(JSON.stringify(error, null, 2));
    throw error;
  }
}

async function loadSearchIndex(): Promise<EmbeddingData[]> {
  return await loadJSON<EmbeddingData[]>(EMBEDDINGS_PATH);
}

async function saveSearchIndex(embeddingData: EmbeddingData[]): Promise<void> {
  const tempEmbeddingsPath = EMBEDDINGS_PATH + ".tmp";
  await fs.writeFile(tempEmbeddingsPath, JSON.stringify(embeddingData));
  await fs.rename(tempEmbeddingsPath, EMBEDDINGS_PATH);
}

async function computeEmbedding(content: string | string[]): Promise<number[][]> {
  const extractor = await pipeline("feature-extraction", MODEL_NAME);
  const embeddings = await extractor(content, { pooling: "mean", normalize: true });
  return embeddings.tolist();
}

export function getFileHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

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

async function readDocumentationFile(fileName: string): Promise<string> {
  try {
    return await fs.readFile(fileName, "utf-8");
  } catch (error) {
    return "";
  }
}

// Register tool to search documentation
server.registerTool(
  "search-docs",
  {
    title: "Search AI Documentation",
    description: `You MUST call this function before 'read-doc' to obtain the correct filename for the documentation you need.\n\nSelection Process:\n1. Analyzes the user's query to understand the subject.\n2. Returns the most relevant document(s) based on semantic similarity.\n\nResponse Format:\n- Returns a ranked list of matching documentation files as a JSON object.\n- Each entry includes the 'path' and a similarity 'score'.\n- If no matches are found, it will state this clearly.`,
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
      "Reads the content of a documentation file given its full path. You MUST call 'search-docs' first to obtain the correct filePath.",
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

export async function reindexDocs(): Promise<{ content: { type: "text"; text: string }[] }> {
  const oldEmbeddingData = await loadSearchIndex();
  const oldEmbeddingMap = new Map(oldEmbeddingData.map((entry) => [entry.path, entry]));

  const docFiles = await fs.readdir(AI_DOCS_DIR);
  const docFilePaths = docFiles.map((f) => path.join(AI_DOCS_DIR, f)).filter(fileHasSupportedExtension);

  const finalEmbeddingData: EmbeddingData[] = [];
  const filesToEmbed: { path: string; content: string }[] = [];
  let modifiedCount = 0;
  let addedCount = 0;

  for (const docFilePath of docFilePaths) {
    const content = await fs.readFile(docFilePath, "utf-8");
    const newHash = getFileHash(content);
    const oldEntry = oldEmbeddingMap.get(docFilePath);

    if (oldEntry) {
      // File exists in old index
      if (newHash === oldEntry.hash) {
        // Unchanged, carry it over
        finalEmbeddingData.push(oldEntry);
      } else {
        // Modified
        modifiedCount++;
        filesToEmbed.push({ path: docFilePath, content });
      }
      // Mark as processed
      oldEmbeddingMap.delete(docFilePath);
    } else {
      // New file
      addedCount++;
      filesToEmbed.push({ path: docFilePath, content });
    }
  }

  // Any remaining entries in oldEmbeddingMap are deleted
  const deletedCount = oldEmbeddingMap.size;

  if (addedCount === 0 && modifiedCount === 0 && deletedCount === 0) {
    return { content: [{ type: "text", text: "No changes detected in documentation." }] };
  }

  // Process new and modified files in a batch
  if (filesToEmbed.length > 0) {
    const contents = filesToEmbed.map((f) => f.content);
    const newEmbeddings = await computeEmbedding(contents);

    filesToEmbed.forEach((file, i) => {
      const hash = getFileHash(file.content);
      finalEmbeddingData.push({ path: file.path, embedding: newEmbeddings[i], hash });
    });
  }

  await saveSearchIndex(finalEmbeddingData);

  return {
    content: [
      {
        type: "text",
        text: `Successfully indexed ${addedCount} new, ${modifiedCount} modified, and removed ${deletedCount} deleted document(s).`,
      },
    ],
  };
}

server.registerTool(
  "reindex-docs",
  {
    title: "Re-index AI Documentation",
    description: "Updates the search index with any new, modified, or deleted documentation files.",
    inputSchema: {},
  },
  async () => {
    return await reindexDocs();
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

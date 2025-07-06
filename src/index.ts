import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { pipeline } from "@xenova/transformers";
import { similarity } from "ml-distance";
import { createHash } from "crypto";

const server = new McpServer({
  name: "ai-docs-server",
  version: "1.0.0",
  instructions: "Use this server to retrieve up-to-date documentation and code examples for the ai_docs directory.",
});

const AI_DOCS_DIR = "ai_docs";
const DATA_DIR = "data";
const MODEL_NAME = "Xenova/all-MiniLM-L6-v2"; // TODO: is there a better model?
const MIN_SIMILARITY_SCORE = 0.4;
const EMBEDDINGS_PATH = path.join(DATA_DIR, "embeddings.json");

interface EmbeddingData {
  path: string;
  embedding: number[];
}

async function loadJSON<T>(filePath: string): Promise<T> {
  const fullPath = path.join(process.cwd(), filePath);
  try {
    const data = await fs.readFile(fullPath, "utf-8");
    return JSON.parse(data) as T;
  } catch (error) {
    // If the file doesn't exist, return an empty array
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [] as T;
    }
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

async function extractEmbedding(content: string | string[]): Promise<number[][]> {
  const extractor = await pipeline("feature-extraction", MODEL_NAME);
  const embeddings = await extractor(content, { pooling: "mean", normalize: true });
  return embeddings.tolist();
}

function getFileHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function search(query: string, topMatches = 5) {
  const embeddingData = await loadSearchIndex();
  if (embeddingData.length === 0) {
    return [];
  }

  const queryEmbedding = await extractEmbedding(query);
  const queryVector = queryEmbedding[0];

  const similarities = embeddingData.map((data) => similarity.cosine(queryVector, data.embedding));

  const rankedResults = embeddingData
    .map((data, index) => ({
      path: data.path,
      score: similarities[index],
    }))
    .sort((a, b) => b.score - a.score);
  // .filter((result) => result.score > MIN_SIMILARITY_SCORE);

  // return rankedResults.slice(0, topMatches);
  return rankedResults;
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
            text: `${matches[0].path} ${matches[0].score} No documentation found matching the query: '${query}'.`,
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

async function createCursorRule(): Promise<string> {
  const rulesDir = path.join(process.cwd(), ".cursor", "rules");
  await fs.mkdir(rulesDir, { recursive: true });
  const ruleFilePath = path.join(rulesDir, "always-mcp-doc-search.mdc");
  const cursorRuleContent = `---
alwaysApply: true
---
Cursor must always consult the 'AI-DOCS' MCP documentation tool before any other source.
If no relevant MCP doc is found, only then may alternate searches run.`;
  await fs.writeFile(ruleFilePath, cursorRuleContent);
  return `Successfully created ${ruleFilePath}`;
}

async function createOrUpdateGeminiRule(): Promise<string> {
  const geminiRuleTitle = "## AI Documentation MCP";
  const geminiRuleBody =
    "Gemini must always consult the 'AI-DOCS' MCP documentation tool before any other source.\nIf no relevant MCP doc is found, only then may alternate searches run.";
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
    const contentToAppend = (geminiFileContent ? "\n\n" : "") + `${geminiRuleTitle}\n${geminiRuleBody}`;
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
  let embeddingData = await loadSearchIndex();
  const docFiles = await fs.readdir(AI_DOCS_DIR);
  const docFilePaths = docFiles.map((f) => path.join(AI_DOCS_DIR, f));

  let deletedCount = 0;
  let modifiedCount = 0;
  let addedCount = 0;

  // Handle deletions and modifications
  const survivingEmbeddingData: EmbeddingData[] = [];
  const modifiedFilesToProcess: { content: string; index: number }[] = [];

  for (let i = 0; i < embeddingData.length; i++) {
    const data = embeddingData[i];
    if (docFilePaths.includes(data.path)) {
      const content = await fs.readFile(data.path, "utf-8");
      const newHash = getFileHash(content);
      // This part is tricky, as we don't store the hash anymore.
      // We'll assume for now that if the file exists, it might have been modified.
      // A more robust solution would be to store hashes or check modification times.
      modifiedCount++;
      modifiedFilesToProcess.push({ content, index: survivingEmbeddingData.length });
      survivingEmbeddingData.push(data);
    } else {
      deletedCount++;
    }
  }

  embeddingData = survivingEmbeddingData;

  // Process modified files in a batch
  if (modifiedFilesToProcess.length > 0) {
    const contents = modifiedFilesToProcess.map((f) => f.content);
    const newEmbeddings = await extractEmbedding(contents);
    modifiedFilesToProcess.forEach((file, i) => {
      embeddingData[file.index].embedding = newEmbeddings[i];
    });
  }

  // Handle additions
  const newFiles = docFilePaths.filter((filePath) => filePath.endsWith(".md") && !embeddingData.some((data) => data.path === filePath));

  if (newFiles.length > 0) {
    addedCount = newFiles.length;
    const contents = await Promise.all(newFiles.map((file) => fs.readFile(file, "utf-8")));
    const newEmbeddings = await extractEmbedding(contents);

    contents.forEach((_content, i) => {
      embeddingData.push({ path: newFiles[i], embedding: newEmbeddings[i] });
    });
  }

  if (addedCount === 0 && deletedCount === 0 && modifiedCount === 0) {
    return {
      content: [{ type: "text", text: "No changes detected in documentation." }],
    };
  }

  await saveSearchIndex(embeddingData);

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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // console.error("AI Docs MCP Server running on stdio");
}

main().catch((error) => {
  // console.error("Fatal error in main():", error);
  process.exit(1);
});

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { pipeline } from "@xenova/transformers";
import { similarity } from "ml-distance";

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
const METADATA_PATH = path.join(DATA_DIR, "file_metadata.json");

interface FileMetadata {
  path: string;
}

async function loadJSON<T>(filePath: string): Promise<T> {
  const fullPath = path.join(process.cwd(), filePath);
  const data = await fs.readFile(fullPath, "utf-8");
  return JSON.parse(data) as T;
}

async function loadSearchIndex(): Promise<{ embeddings: number[][]; metadata: FileMetadata[] }> {
  const embeddings = await loadJSON<number[][]>(EMBEDDINGS_PATH);
  const metadata = await loadJSON<FileMetadata[]>(METADATA_PATH);
  return { embeddings, metadata };
}

async function saveSearchIndex(embeddings: number[][], metadata: FileMetadata[]): Promise<void> {
  await fs.writeFile(EMBEDDINGS_PATH, JSON.stringify(embeddings));
  await fs.writeFile(METADATA_PATH, JSON.stringify(metadata));
}

async function extractEmbedding(content: string): Promise<number[]> {
  const extractor = await pipeline("feature-extraction", MODEL_NAME);
  const embedding = await extractor(content, { pooling: "mean", normalize: true });
  return Array.from(embedding.data);
}

async function search(query: string, topMatches = 5) {
  const { embeddings, metadata } = await loadSearchIndex();

  const queryVector = await extractEmbedding(query);

  const similarities = embeddings.map((embedding) => similarity.cosine(queryVector, embedding));

  const rankedResults = metadata
    .map((meta, index) => ({
      path: meta.path,
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
            text: `No documentation found matching the query: '${query}'.`,
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
Cursor must always consult the MCP documentation corpus before any other source.
If no relevant MCP doc is found, only then may alternate searches run.`;
  await fs.writeFile(ruleFilePath, cursorRuleContent);
  return `Successfully created ${ruleFilePath}`;
}

async function createOrUpdateGeminiRule(): Promise<string> {
  const geminiRuleTitle = "## AI Documentation MCP";
  const geminiRuleBody =
    "Gemini must always consult the MCP documentation corpus before any other source.\nIf no relevant MCP doc is found, only then may alternate searches run.";
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

server.registerTool(
  "reindex-docs",
  {
    title: "Re-index AI Documentation",
    description: "Updates the search index with any new documentation files.",
    inputSchema: {},
  },
  async () => {
    const { embeddings, metadata } = await loadSearchIndex();

    const docFiles = await fs.readdir(AI_DOCS_DIR);
    const newFiles = docFiles.filter((file) => file.endsWith(".md") && !metadata.some((meta) => meta.path.endsWith(file)));

    if (newFiles.length === 0) {
      return {
        content: [{ type: "text", text: "No new documents to index." }],
      };
    }

    for (const file of newFiles) {
      const filePath = path.join(AI_DOCS_DIR, file);
      const content = await fs.readFile(filePath, "utf-8");
      const embedding = await extractEmbedding(content);
      embeddings.push(embedding);
      metadata.push({ path: filePath });
    }

    await saveSearchIndex(embeddings, metadata);

    return {
      content: [{ type: "text", text: `Successfully indexed ${newFiles.length} new document(s).` }],
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

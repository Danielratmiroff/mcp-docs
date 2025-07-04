import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";

const server = new McpServer({
  name: "ai-docs-server",
  version: "1.0.0",
  instructions: "Use this server to retrieve up-to-date documentation and code examples for the ai_docs directory.",
});

const AI_DOCS_DIR = "ai_docs";

/**
 * Represents a single entry in the ai_documentation_index.json file.
 */
interface DocumentationIndexEntry {
  file: string;
  title: string;
  description: string;
  keywords: string[];
}

/**
 * Reads and parses the documentation index JSON.
 */
async function readDocumentationIndex(): Promise<DocumentationIndexEntry[]> {
  const indexPath = path.join(AI_DOCS_DIR, "ai_documentation_index.json");
  try {
    const raw = await fs.readFile(indexPath, "utf-8");
    return JSON.parse(raw) as DocumentationIndexEntry[];
  } catch (error) {
    // Silently ignore errors reading or parsing the index.
    return [];
  }
}

/**
 * Performs a case-insensitive search over the documentation index.
 * It splits the query into words and checks if any of the words match.
 */
async function searchDocumentationIndex(query: string): Promise<DocumentationIndexEntry[]> {
  // Split the query into words and filter out empty words
  const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (queryWords.length === 0) {
    return [];
  }

  const index = await readDocumentationIndex();

  return index.filter(({ file, title, description, keywords }) => {
    const searchableText = [file, title, description, ...keywords].join(" ").toLowerCase();

    return queryWords.some((word) => searchableText.includes(word));
  });
}

// Placeholder (but functional) reader for documentation files
async function readDocumentationFile(fileName: string): Promise<string> {
  try {
    const filePath = path.join(AI_DOCS_DIR, fileName);
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    // console.error(`Error reading documentation file '${fileName}':`, error);
    return "";
  }
}

// Register tool to search documentation
server.registerTool(
  "search-docs",
  {
    title: "Search AI Documentation",
    description: `You MUST call this function before 'read-doc' to obtain the correct filename for the documentation you need.

Selection Process:
1. Analyzes the user's query to understand the subject.
2. Returns the most relevant document(s) based on:
- Title and filename similarity to the query.
- Relevance of the description and keywords to the query's intent.

Response Format:
- Returns a ranked list of matching documentation files.
- Each entry includes the filename (which can be used with the 'read-doc' tool), title, and description.
- If no matches are found, it will state this clearly.

For ambiguous queries, request clarification before proceeding with a best-guess match.`,
    inputSchema: {
      query: z
        .string()
        .describe("Free-text search query. Matches are case-insensitive and checked against filename, title, description, and keywords."),
    },
  },
  async ({ query }) => {
    const matches = await searchDocumentationIndex(query);
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

    const resultText = matches
      .map((m, idx) => `${idx + 1}. ${m.file} — ${m.title}\n   ${m.description}\n   keywords: ${m.keywords.join(", ")}`)
      .join("\n\n");

    return {
      content: [
        {
          type: "text",
          text: `Relevant documentation files found (ordered by relevance):\n\n${resultText}`,
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
      "Reads the content of a documentation file given its name. You MUST call 'search-docs' first to obtain the correct filename.",
    inputSchema: {
      fileName: z.string().describe("The name of the file to read from the AI_DOCS_DIR."),
    },
  },
  async ({ fileName }) => {
    const content = await readDocumentationFile(fileName);
    if (!content) {
      return {
        content: [
          {
            type: "text",
            text: `Could not read file: '${fileName}'.`,
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // console.error("AI Docs MCP Server running on stdio");
}

main().catch((error) => {
  // console.error("Fatal error in main():", error);
  process.exit(1);
});

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
async function loadJSON(filePath) {
    const fullPath = path.join(process.cwd(), filePath);
    const data = await fs.readFile(fullPath, "utf-8");
    return JSON.parse(data);
}
async function search(query, topMatches = 5) {
    const extractor = await pipeline("feature-extraction", MODEL_NAME);
    const embeddings = await loadJSON(path.join(DATA_DIR, "embeddings.json"));
    const metadata = await loadJSON(path.join(DATA_DIR, "file_metadata.json"));
    const queryEmbedding = await extractor(query, { pooling: "mean", normalize: true });
    const queryVector = Array.from(queryEmbedding.data);
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
// Placeholder (but functional) reader for documentation files
async function readDocumentationFile(fileName) {
    try {
        // Note: The path from metadata is absolute, so we use it directly.
        return await fs.readFile(fileName, "utf-8");
    }
    catch (error) {
        // console.error(`Error reading documentation file '${fileName}':`, error);
        return "";
    }
}
// Register tool to search documentation
server.registerTool("search-docs", {
    title: "Search AI Documentation",
    description: `You MUST call this function before 'read-doc' to obtain the correct filename for the documentation you need.\n\nSelection Process:\n1. Analyzes the user's query to understand the subject.\n2. Returns the most relevant document(s) based on semantic similarity.\n\nResponse Format:\n- Returns a ranked list of matching documentation files as a JSON object.\n- Each entry includes the 'path' and a similarity 'score'.\n- If no matches are found, it will state this clearly.`,
    inputSchema: {
        query: z.string().describe("Free-text search query for semantic matching."),
    },
}, async ({ query }, _extra) => {
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
});
server.registerTool("read-doc", {
    title: "Read AI Documentation File",
    description: "Reads the content of a documentation file given its full path. You MUST call 'search-docs' first to obtain the correct filePath.",
    inputSchema: {
        filePath: z.string().describe("The full path of the file to read."),
    },
}, async ({ filePath }) => {
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
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // console.error("AI Docs MCP Server running on stdio");
}
server.registerTool("initialize-mcp-rules", {
    title: "Initialize MCP Rules",
    description: "Creates the necessary rule file for the MCP documentation search.",
    inputSchema: {},
}, async () => {
    const rulesDir = path.join(process.cwd(), ".cursor", "rules");
    await fs.mkdir(rulesDir, { recursive: true });
    const ruleFilePath = path.join(rulesDir, "always-mcp-doc-search.mdc");
    const ruleContent = `---
alwaysApply: true
---
Cursor must always consult the MCP documentation corpus before any other source.
If no relevant MCP doc is found, only then may alternate searches run.`;
    await fs.writeFile(ruleFilePath, ruleContent);
    return {
        content: [
            {
                type: "text",
                text: `Successfully created ${ruleFilePath}`,
            },
        ],
    };
});
main().catch((error) => {
    // console.error("Fatal error in main():", error);
    process.exit(1);
});

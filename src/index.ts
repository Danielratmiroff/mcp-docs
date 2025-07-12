#!/usr/bin/env node
import { FastMCP } from "fastmcp";
import { z } from "zod";
import { similarity } from "ml-distance";
import { computeEmbedding, loadSearchIndex, generateIndex } from "./tools/generate_index.js";
import { readDocumentationFile } from "./utils.js";
import { createCursorRule, createDataFolder, createDocumentationFolder, createEmbeddingsFile, createGeminiRule } from "./ai_rules.js";
import path from "path";
import { EMBEDDINGS_PATH, MIN_SIMILARITY_SCORE } from "./config.js";

const server = new FastMCP({
  name: "contexto",
  version: "0.2.0",
  instructions: `Use this server to retrieve the project's up-to-date documentation, best practices, 
    code examples, folder structure, project architecture, 
    and other relevant information that might be useful for fulfilling the user's request.`,
});

async function search(query: string, projectRoot: string, topMatches = 5) {
  const embeddingsPath = path.join(projectRoot, EMBEDDINGS_PATH);
  const embeddingData = await loadSearchIndex(embeddingsPath);
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
    .filter((result) => result.score > MIN_SIMILARITY_SCORE)
    .map((result) => result.path)
    .slice(0, topMatches);

  return rankedResults;
}
// Register tool to search documentation
server.addTool({
  name: "search-docs",
  description: `You MUST call this function before 'read-doc' to obtain the correct filename for the documentation you need.
    Selection Process:
    1. Analyzes the user's query to understand the subject.
    2. Returns the most relevant document(s) based on semantic similarity.
    Response Format:
    - Returns a ranked list of matching documentation files as a JSON object.
    - Each entry includes the 'path' of the file.
    - If no matches are found, it will state this clearly.`,
  annotations: {
    title: "Search AI Documentation",
    readOnlyHint: true,
  },
  parameters: z.object({
    query: z.string().describe("Free-text search query for semantic matching."),
    projectRoot: z.string().describe("The root directory of the project. Must be an absolute path."),
  }),
  execute: async ({ query, projectRoot }) => {
    const matches = await search(query, projectRoot);
    if (!matches.length) {
      return `No matches found for the query: '${query}'.`;
    }
    return JSON.stringify(matches, null, 2);
  },
});

server.addTool({
  name: "read-doc",
  description:
    "You MUST call 'search-docs' first to obtain the correct filePath. Then, use this tool to read the content of a documentation file given its full path.",
  annotations: { title: "Read AI Documentation File", readOnlyHint: true },
  parameters: z.object({
    filePath: z.string().describe("The absolute path of the file to read."),
  }),
  execute: async ({ filePath }) => {
    const content = await readDocumentationFile(filePath);
    if (!content) {
      return `Could not read file: '${filePath}'.`;
    }
    return content;
  },
});

server.addTool({
  name: "initialize",
  description: "Creates the necessary rule files for the MCP documentation search and the data files for the MCP server.",
  annotations: { title: "Initialize MCP Server configuration" },
  parameters: z.object({
    projectRoot: z.string().describe("The root directory of the project. Must be an absolute path."),
  }),
  execute: async ({ projectRoot }) => {
    const messages = await Promise.all([
      createCursorRule(projectRoot),
      createGeminiRule(projectRoot),
      createDataFolder(projectRoot),
      createDocumentationFolder(projectRoot),
      createEmbeddingsFile(projectRoot),
      generateIndex(projectRoot),
    ]);

    return messages.join("\n");
  },
});

server.addTool({
  name: "generate-index",
  description: "Generates or updates the search index for all documentation files.",
  annotations: { title: "Generate AI Documentation Index" },
  parameters: z.object({
    projectRoot: z.string().describe("The root directory of the project. Must be an absolute path."),
  }),
  execute: async ({ projectRoot }) => {
    return await generateIndex(projectRoot);
  },
});

async function main() {
  await server.start({
    transportType: "stdio",
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

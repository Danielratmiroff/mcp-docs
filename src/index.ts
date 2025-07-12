#!/usr/bin/env node
import { createDoc } from "./tools/create_doc.js";
import { FastMCP } from "fastmcp";
import { z } from "zod";
import { similarity } from "ml-distance";
import { deleteDoc } from "./tools/delete_doc.js";
import { computeEmbedding, loadSearchIndex, MIN_SIMILARITY_SCORE, generateIndex } from "./tools/generate_index.js";
import { logToFile, readDocumentationFile } from "./utils.js";
import { createCursorRule, createDataFolder, createDocumentationFolder, createEmbeddingsFile, createGeminiRule } from "./ai_rules.js";

const server = new FastMCP({
  name: "contexto",
  version: "1.0.0",
  instructions: `Use this server to retrieve the project's up-to-date documentation, best practices, 
    code examples, folder structure, project architecture, 
    and other relevant information that might be useful for fulfilling the user's request.`,
});

async function search(query: string, projectRoot: string, topMatches = 5) {
  const embeddingData = await loadSearchIndex(projectRoot);
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
      return {
        content: [{ type: "text", text: `No matches found for the query: '${query}'.` }],
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(matches, null, 2) }],
    };
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
      return {
        content: [{ type: "text", text: `Could not read file: '${filePath}'.` }],
      };
    }
    return {
      content: [{ type: "text", text: content }],
    };
  },
});

// server.addTool({
//   name: "delete-doc",
//   description:
//     "Deletes a documentation file from the ai_docs folder and reindexes the embeddings so it is not accessible through other tools.",
//   annotations: { title: "Delete AI Documentation File" },
//   parameters: z.object({
//     fileName: z.string().describe("Name of the documentation file to delete (with or without .md extension)."),
//   }),
//   execute: async ({ fileName }: { fileName: string }) => {
//     try {
//       // await deleteDoc(fileName);
//       return {
//         content: [{ type: "text", text: `Deleted '${fileName}' and reindexed documentation.` }],
//       };
//     } catch (error: any) {
//       return {
//         content: [
//           {
//             type: "text",
//             text: `Error deleting file '${fileName}': ${error instanceof Error ? error.message : String(error)}`,
//           },
//         ],
//       };
//     }
//   },
// });

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

    return {
      content: [{ type: "text", text: `messages: ${messages.join("\n")}` }],
    };
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

// server.addTool({
//   name: "create-doc",
//   description: "Creates a new documentation file and re-indexes the documentation.",
//   annotations: { title: "Create AI Documentation File" },
//   parameters: z.object({
//     fileName: z.string().describe("The name of the file to create."),
//     content: z.string().describe("The content of the file."),
//   }),
//   execute: async ({ fileName, content }) => {
//     // await createDoc(fileName, content);
//     return {
//       content: [
//         {
//           type: "text",
//           text: `Successfully created and indexed '${fileName}'.`,
//         },
//       ],
//     };
//   },
// });

async function main() {
  await server.start({
    transportType: "stdio",
  });
  // console.error("AI Docs MCP Server running on stdio");
}

main().catch((error) => {
  // console.error("Fatal error in main():", error);
  process.exit(1);
});

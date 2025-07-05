# MCP Server Documentation

This document provides an overview of the Model Context Protocol (MCP) server, its structure, and how to interact with it.

## Embeddings for Document Search

The core of the documentation search functionality relies on **embeddings**.

1. **Embed** every markdown file → vector store (embeddings) (`data/embeddings.json`).
2. **Query** → converted to the same vector space.
3. **Search** cosine similarity between the query and the embeddings → return top matches.

## Folder Map

```mermaid
graph TD
  A[Project Root] --> B[ai_docs/ \nMarkdown docs]
  A --> C[data/]
  A --> D[src/]

  C --> C1[embeddings.json]
  C --> C2[file_metadata.json]

  D --> D1[index.ts \nHTTP + tools]
  D --> D2[generate_embeddings.ts]
```

## MCP Server Tools

The MCP server exposes the following tools for interaction:

### `search-docs`

- **Purpose:** To find the most relevant documentation based on a natural language query.
- **Input:** A `query` string.
- **Output:** A JSON object containing a ranked list of the most relevant documents. Each object in the list includes the `path` to the document and a similarity `score`.

### `read-doc`

- **Purpose:** To read the content of a specific documentation file.
- **Input:** The `filePath` of the document to be read. This path is obtained from the results of the `search-docs` tool.
- **Output:** The full content of the specified documentation file as a string.

### `init`

- **Purpose:** To set up the necessary configuration files for both the AI and the developer environment.
- **Input:** None.
- **Output:** Confirmation messages indicating the successful creation of the rule files.
- **Details:** This tool creates:
  1.  A rule file at `.cursor/rules/always-mcp-doc-search.mdc` to instruct Cursor to always consult this documentation first.
  2.  A `GEMINI.md` file with a similar rule for Gemini.

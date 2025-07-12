# `src/index.ts` Documentation

This document provides an overview of the `src/index.ts` file, its structure, main exports, and how to interact with or extend it.

## Purpose

The `src/index.ts` file serves as the main entry point for the Contexto MCP server. It sets up and starts the FastMCP server, registers documentation tools, and coordinates the documentation search, reading, creation, and indexing functionalities.

## Main Responsibilities

- Initialize and configure the FastMCP server for documentation search and management.
- Register tools for searching, reading, creating, and indexing documentation files.
- Handle embedding-based semantic search for documentation queries.
- Provide initialization routines for project documentation infrastructure.

## Key Exports and Tools

### Tools Registered

- **`search-docs`**: Semantic search for relevant documentation files based on a query.
- **`read-doc`**: Read the content of a specific documentation file.
- **`initialize`**: Set up rule files and data folders for documentation search.
- **`generate-index`**: Generate or update the search index for all documentation files.

> Note: The `create-doc` and `delete-doc` tools are implemented but currently commented out in the code.

### Main Functions

- `search(query: string, projectRoot: string, topMatches = 5)`: Performs semantic search over documentation embeddings.
- `main()`: Starts the FastMCP server using stdio transport.

## Usage

The server is started automatically by invoking the `main()` function. It listens for tool invocations via stdio and responds to documentation-related queries and commands.

### Example: Searching Documentation

Use the `search-docs` tool with a natural language query to find relevant documentation files. Then, use `read-doc` to read the file content.

### Example: Initializing Documentation Infrastructure

Use the `initialize` tool to set up all required rule files and data folders for the documentation system.

## Extending `src/index.ts`

- To add new tools, use `server.addTool({...})` with appropriate parameters and logic.
- To enable or modify existing tools (e.g., `create-doc`, `delete-doc`), uncomment and adjust their registration blocks.
- For new embedding or search strategies, update the `search` function and related utilities.

## Related Files

- `src/tools/create_doc.ts`: Logic for creating new documentation files.
- `src/tools/delete_doc.ts`: Logic for deleting documentation files.
- `src/tools/generate_index.ts`: Embedding and indexing logic.
- `src/ai_rules.ts`: Rule and folder creation utilities.
- `ai_docs/`: Folder containing all markdown documentation files.

---

For more details on the available tools and their parameters, see the [mcp_server_documentation.md](./mcp_server_documentation.md) file.

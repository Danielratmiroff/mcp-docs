import path from "path";

// Embeddings config
export const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";
export const MIN_SIMILARITY_SCORE = 0.4;

// AI Docs config
export const AI_DOCS_DIR_NAME = "docs";
export const DATA_DIR_NAME = "data";
export const EMBEDDINGS_FILE_NAME = "embeddings.json";

export const EMBEDDINGS_PATH = path.join(DATA_DIR_NAME, EMBEDDINGS_FILE_NAME);
export const SUPPORTED_FILE_EXTENSIONS = [".md", ".txt"];

// Gemini config
export const GEMINI_DIR_NAME = ".gemini";
export const GEMINI_SETTINGS_FILE_NAME = "settings.json";

export const GEMINI_CONTEXT_FILE_NAME = "GEMINI.md";
export const CONTEXTO_GEMINI_FILE_NAME = "CONTEXTO_GEMINI.md";

// Cursor config
export const CURSOR_DIR_NAME = ".cursor";
export const CURSOR_RULES_DIR_NAME = "rules";
export const CURSOR_RULES_FILE_NAME = "mcp-contexto.mdc";
export const CURSOR_RULES_PATH = path.join(CURSOR_DIR_NAME, CURSOR_RULES_DIR_NAME, CURSOR_RULES_FILE_NAME);

// Rules config
export const AI_DOCS_MCP_DESCRIPTION = `
# CONTEXTO MCP

You MUST use the 'CONTEXTO' MCP tool kit to retrieve the project's up-to-date documentation, best practices,
code examples, folder structure, project architecture,
and other relevant information that might be useful for fulfilling the user's request.

You should ALWAYS consult the 'CONTEXTO' MCP documentation when you are unsure or have a question about the project's architecture, best practices, or other relevant information.

Assume ${AI_DOCS_DIR_NAME} is the folder where the documentation is stored, unless the user specifies otherwise.
You MUST generate a new index of the documentation every time you create, modify, or delete a file in the ${AI_DOCS_DIR_NAME} folder.
`;

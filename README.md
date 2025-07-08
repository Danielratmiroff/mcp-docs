# Contexto

Contexto is a Model Context Protocol (MCP) documentation server that makes your project's documentation available to AI assistants. Enabling them to follow your project's best practices and architecture.

## Main Features 🤖

- **Context to AI assistants:** Make your project's documentation available to AI assistants.
- **Semantic Search:** Find the right document just by asking questions.
- **Documentation Management:** Empower AI assistants to easily create, read, and delete documentation files.
- **AI Integration:** Sets up configuration files to seamlessly connect with AI tools like Cursor and Gemini.

## How to Use 🔍

Contexto pulls your up-to-date documentation and uses it as context for your LLM prompt.

1. Write your prompt naturally.
2. The AI will determine if it needs to use Contexto to anwser your question more effectively.

or enforce the use of Contexto by appending "use contexto" to your prompt.

Examples:

```text
Create a Next.js middleware for JWT authentication with cookie validation and login redirect. use contexto
```

No manual searches, no outdated code, just real-time docs in your context.

## Installation 🚀

### Requirements

- Node.js >= v18.0.0
- MCP client (e.g. Cursor, Claude Code, VS Code, etc.)

### Install in Cursor

Go to: Settings -> Cursor Settings -> MCP -> Add new global MCP server.

```json
{
  "mcpServers": {
    "contexto": {
      "command": "npx",
      "args": ["-y", "contexto"]
    }
  }
}
```

### Install in VS Code

Add the following to your VS Code MCP config (e.g., in `settings.json`):

```json
"mcp": {
  "servers": {
    "contexto": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "contexto"]
    }
  }
}
```

### Install in Gemini CLI

Open or create `~/.gemini/settings.json` or your project's `.gemini/settings.json` and add:

```json
{
  "mcpServers": {
    "contexto": {
      "command": "npx",
      "args": ["-y", "contexto"]
    }
  }
}
```

### Install in Claude Code

```bash
claude mcp add contexto -- npx -y contexto
```

## Contributing 🤝

Contributions are welcome! Please feel free to submit a pull request.

## Happy coding! 🚀

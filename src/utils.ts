import * as fs from "fs/promises";
import * as path from "path";

const logFilePath = path.join("/home/daniel/code/mcp-docs", "mcp.log");

/**
 * Logs a message to a file.
 * @param message - The message to log.
 */
export function logToFile(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}\n`;

  fs.appendFile(logFilePath, logMessage).catch((err) => {
    console.error("Failed to write to log file:", err);
  });
}

/**
 * Checks if a file exists.
 * @param filePath - The full path of the file to check.
 * @returns True if the file exists, false otherwise.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  return fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);
}

/**
 * Reads the content of a documentation file given its full path.
 * @param filePath - The full path of the file to read.
 * @returns The content of the file or an empty string if the file does not exist.
 */
export async function readDocumentationFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    return "";
  }
}

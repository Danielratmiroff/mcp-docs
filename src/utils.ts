import * as fs from "fs/promises";
import * as path from "path";

/**
 * Logs a message to a file.
 * @param message - The message to log.
 */
export async function logToFile(message: string): Promise<void> {
  const logDir = path.join(process.cwd(), "logs");
  await createDirectory(logDir);
  const timestamp = new Date().toISOString();
  const logFile = path.join(logDir, "mcp.log");
  await fs.appendFile(logFile, `[${timestamp}] ${message}\n`);
}

/**
 * Checks if a file exists.
 * @param filePath - The full path of the file to check.
 * @returns True if the file exists, false otherwise.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a file if it does not exist.
 * @param filePath - The full path of the file to create.
 * @param content - The content of the file to create.
 */
export async function createFile(filePath: string, content: string): Promise<void> {
  if (!(await fileExists(filePath))) {
    await fs.writeFile(filePath, content);
  }
}

/**
 * Creates a directory if it does not exist.
 * @param dirPath - The full path of the directory to create.
 */
export async function createDirectory(dirPath: string): Promise<void> {
  if (!(await fileExists(dirPath))) {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Reads the content of a documentation file given its full path.
 * @param filePath - The full path of the file to read.
 * @returns The content of the file or an empty string if the file does not exist.
 */
export async function readDocumentationFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return "";
  }
}

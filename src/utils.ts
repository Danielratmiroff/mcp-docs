import * as fs from "fs/promises";
import * as path from "path";
import * as fsSync from "fs";
import { fileURLToPath } from "url";

/**
 * Logs a message to a file.
 * @param message - The message to log.
 */
export async function logToFile(message: string): Promise<void> {
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    throw new Error("Failed to find project root.");
  }
  const logDir = path.join(projectRoot, "logs");
  if (!(await fileExists(logDir))) {
    await fs.mkdir(logDir, { recursive: true });
  }
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

/**
 * Recursively searches for a project root starting from a given directory.
 * It can search both upwards and downwards.
 * @param startDir The directory to start searching from.
 * @param markers An array of file or directory names that mark a project root.
 * @returns The path to the project root, or null if not found.
 */
export function findProjectRoot(
  /** We start from the directory of the compiled file that imports this helper. */
  startDir: string = path.dirname(fileURLToPath(import.meta.url)),
  markers: string[] = ["package.json", ".git"]
): string | null {
  let dir = path.resolve(startDir);

  while (true) {
    for (const marker of markers) {
      if (fsSync.existsSync(path.join(dir, marker))) {
        return dir;
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error("No project root found");
    }

    dir = parent;
  }
}

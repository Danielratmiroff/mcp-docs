import * as fs from "fs/promises";
import * as path from "path";
import * as fsSync from "fs";

export const LOG_DIR = path.join(process.cwd(), "logs");
export const LOG_FILE = path.join(LOG_DIR, "mcp.log");

/**
 * Logs a message to a file.
 * @param message - The message to log.
 */
export async function logToFile(message: string): Promise<void> {
  if (!(await fileExists(LOG_DIR))) {
    await fs.mkdir(LOG_DIR, { recursive: true });
  }
  const timestamp = new Date().toISOString();
  await fs.appendFile(LOG_FILE, `[${timestamp}] ${message}\n`);
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
  startDir: string = process.cwd(),
  markers: string[] = ["package.json", ".git", "pyproject.toml"]
): string | null {
  const currentDir = startDir;

  // Upward search
  let upwardDir: string | null = currentDir;
  while (upwardDir) {
    for (const marker of markers) {
      if (fsSync.existsSync(path.join(upwardDir, marker))) {
        return upwardDir;
      }
    }
    const parentDir = path.dirname(upwardDir);
    if (parentDir === upwardDir) {
      break;
    }
    upwardDir = parentDir;
  }

  // // Downward search
  // const queue: string[] = [currentDir];
  // const visited: Set<string> = new Set(queue);

  // while (queue.length > 0) {
  //   const dir = queue.shift()!;
  //   for (const marker of markers) {
  //     if (fsSync.existsSync(path.join(dir, marker))) {
  //       return dir;
  //     }
  //   }

  //   try {
  //     const entries = fsSync.readdirSync(dir, { withFileTypes: true });
  //     for (const entry of entries) {
  //       if (entry.isDirectory()) {
  //         const fullPath = path.join(dir, entry.name);
  //         if (!visited.has(fullPath)) {
  //           visited.add(fullPath);
  //           queue.push(fullPath);
  //         }
  //       }
  //     }
  //   } catch (error) {
  //     // Ignore errors from directories we can't read
  //   }
  // }

  return null;
}

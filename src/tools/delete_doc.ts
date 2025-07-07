import { reindexDocs } from "../index.ts";
import { promises as fs } from "fs";
import path from "path";

const DOCS_DIR = path.join(process.cwd(), "ai_docs");

/**
 * Deletes a markdown documentation file from the ai_docs directory.
 * @param fileName Name of the file to delete, with or without .md extension
 */
export async function deleteDoc(fileName: string): Promise<void> {
  const filePath = path.join(DOCS_DIR, fileName);
  await fs.unlink(filePath);
  await reindexDocs();
}

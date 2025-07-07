import { reindexDocs } from "./index.ts";
import { promises as fs } from "fs";
import path from "path";

const DOCS_DIR = path.join(process.cwd(), "ai_docs");

export async function createDoc(fileName: string, content: string): Promise<void> {
  if (!fileName.endsWith(".md")) {
    fileName += ".md";
  }

  const filePath = path.join(DOCS_DIR, fileName);

  await fs.writeFile(filePath, content);

  await reindexDocs();
}

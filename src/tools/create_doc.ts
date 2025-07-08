import * as fs from "fs/promises";
import * as path from "path";
import { generateIndex } from "./generate_index.js";

const AI_DOCS_DIR = path.join(process.cwd(), "ai_docs");

export async function createDoc(fileName: string, content: string) {
  if (!fileName.endsWith(".md")) {
    fileName += ".md";
  }
  const filePath = path.join(AI_DOCS_DIR, fileName);
  await fs.writeFile(filePath, content);
  await generateIndex();
}

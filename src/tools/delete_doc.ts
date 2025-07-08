import * as fs from "fs/promises";
import * as path from "path";
import { generateIndex } from "./generate_index.js";

const AI_DOCS_DIR = path.join(process.cwd(), "ai_docs");

export async function deleteDoc(fileName: string) {
  if (!fileName.endsWith(".md")) {
    fileName += ".md";
  }
  const filePath = path.join(AI_DOCS_DIR, fileName);
  await fs.unlink(filePath);
  await generateIndex();
}

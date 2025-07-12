import * as fs from "fs/promises";
import * as path from "path";
import { generateIndex } from "./generate_index.js";

export async function deleteDoc(fileName: string, projectRoot: string) {
  if (!fileName.endsWith(".md")) {
    fileName += ".md";
  }
  const filePath = path.join(projectRoot, "ai_docs", fileName);
  await fs.unlink(filePath);
  await generateIndex(projectRoot);
}

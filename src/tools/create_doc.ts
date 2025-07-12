import * as fs from "fs/promises";
import * as path from "path";
import { generateIndex } from "./generate_index.js";

export async function createDoc(fileName: string, content: string, projectRoot: string) {
  if (!fileName.endsWith(".md")) {
    fileName += ".md";
  }
  const filePath = path.join(projectRoot, "ai_docs", fileName);
  await fs.writeFile(filePath, content);
  await generateIndex(projectRoot);
}

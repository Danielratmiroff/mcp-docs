import * as fs from "fs/promises";
import * as path from "path";
import { generateIndex } from "./generate_index.js";
import { findProjectRoot } from "../utils.js";

export async function deleteDoc(fileName: string) {
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    throw new Error("Failed to find project root.");
  }
  if (!fileName.endsWith(".md")) {
    fileName += ".md";
  }
  const filePath = path.join(projectRoot, "ai_docs", fileName);
  await fs.unlink(filePath);
  await generateIndex();
}

import * as fs from "fs/promises";
import * as path from "path";
import { pipeline } from "@xenova/transformers";
import { createHash } from "crypto";
import { fileExists, logToFile } from "../utils.js";
import { EmbeddingData } from "../types.js";
import { AI_DOCS_DIR_NAME, EMBEDDINGS_PATH, MODEL_NAME, SUPPORTED_FILE_EXTENSIONS } from "../config.js";

async function loadJSON<T>(filePath: string): Promise<T> {
  if (!(await fileExists(filePath))) {
    return [] as T;
  }
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data) as T;
  } catch (error) {
    logToFile(JSON.stringify(error, null, 2));
    throw error;
  }
}

function fileHasSupportedExtension(filePath: string): boolean {
  return SUPPORTED_FILE_EXTENSIONS.some((ext) => filePath.endsWith(ext));
}

export async function loadSearchIndex(embeddingsPath: string): Promise<EmbeddingData[]> {
  return await loadJSON<EmbeddingData[]>(embeddingsPath);
}

async function saveSearchIndex(embeddingData: EmbeddingData[], embeddingsPath: string): Promise<void> {
  const tempEmbeddingsPath = embeddingsPath + ".tmp";
  await fs.writeFile(tempEmbeddingsPath, JSON.stringify(embeddingData));
  await fs.rename(tempEmbeddingsPath, embeddingsPath);
}

export async function computeEmbedding(content: string | string[]): Promise<number[][]> {
  const extractor = await pipeline("feature-extraction", MODEL_NAME);
  const embeddings = await extractor(content, { pooling: "mean", normalize: true });
  return embeddings.tolist();
}

export function getFileHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * This function is used to generate an index of the documentation files in the project.
 * For performance reasons, we only generate a new index if:
 * - File modification: We check for file hashes to detect if the file has been modified.
 * - File addition & deletion: We check for file deletions.
 */
export async function generateIndex(projectRoot: string): Promise<string> {
  const embeddingsPath = path.join(projectRoot, EMBEDDINGS_PATH);
  const oldEmbeddingData = await loadSearchIndex(embeddingsPath);
  const oldEmbeddingMap = new Map(oldEmbeddingData.map((entry) => [entry.path, entry]));

  const aiFolderPath = path.join(projectRoot, AI_DOCS_DIR_NAME);
  if (!(await fileExists(aiFolderPath))) {
    return `No documentation directory found. Path: ${aiFolderPath}`;
  }

  const docFiles = await fs.readdir(aiFolderPath);
  const docFilePaths = docFiles.map((f) => path.join(aiFolderPath, f)).filter(fileHasSupportedExtension);

  const finalEmbeddingData: EmbeddingData[] = [];
  const filesToEmbed: { path: string; content: string }[] = [];
  let modifiedCount = 0;
  let addedCount = 0;

  for (const docFilePath of docFilePaths) {
    const content = await fs.readFile(docFilePath, "utf-8");
    const newHash = getFileHash(content);
    const oldEntry = oldEmbeddingMap.get(docFilePath);

    // Check if the file has been modified
    if (oldEntry) {
      if (newHash === oldEntry.hash) {
        // No changes detected
        finalEmbeddingData.push(oldEntry);
      } else {
        // File has been modified
        modifiedCount++;
        filesToEmbed.push({ path: docFilePath, content });
      }
      oldEmbeddingMap.delete(docFilePath);
    } else {
      // File has been added
      addedCount++;
      filesToEmbed.push({ path: docFilePath, content });
    }
  }

  // Compute deleted count
  const deletedCount = oldEmbeddingMap.size;

  // Set output logs
  const outputInfo = `Documentation path: ${aiFolderPath}\nEmbeddings path: ${embeddingsPath}`;

  // No changes detected
  if (addedCount === 0 && modifiedCount === 0 && deletedCount === 0) {
    return `No changes detected in documentation.\n${outputInfo}`;
  }

  // Compute new embeddings
  if (filesToEmbed.length > 0) {
    const contents = filesToEmbed.map((f) => f.content);
    const newEmbeddings = await computeEmbedding(contents);

    filesToEmbed.forEach((file, i) => {
      const hash = getFileHash(file.content);
      finalEmbeddingData.push({ path: file.path, embedding: newEmbeddings[i], hash });
    });
  }

  // Save new embeddings
  await saveSearchIndex(finalEmbeddingData, embeddingsPath);

  return `Successfully indexed ${addedCount} new, ${modifiedCount} modified, and removed ${deletedCount} deleted document(s).\n${outputInfo}`;
}

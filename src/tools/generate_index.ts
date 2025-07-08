import * as fs from "fs/promises";
import * as path from "path";
import { pipeline } from "@xenova/transformers";
import { createHash } from "crypto";
import { fileExists, logToFile } from "../utils.js";
import { EmbeddingData } from "../types.js";

export const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";
export const MIN_SIMILARITY_SCORE = 0.4;
export const AI_DOCS_DIR = path.join(process.cwd(), "ai_docs");

export const DATA_DIR = path.join(process.cwd(), "data");
export const EMBEDDINGS_PATH = path.join(DATA_DIR, "embeddings.json");
export const SUPPORTED_FILE_EXTENSIONS = [".md", ".txt"];

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

export async function loadSearchIndex(): Promise<EmbeddingData[]> {
  return await loadJSON<EmbeddingData[]>(EMBEDDINGS_PATH);
}

async function saveSearchIndex(embeddingData: EmbeddingData[]): Promise<void> {
  const tempEmbeddingsPath = EMBEDDINGS_PATH + ".tmp";
  await fs.writeFile(tempEmbeddingsPath, JSON.stringify(embeddingData));
  await fs.rename(tempEmbeddingsPath, EMBEDDINGS_PATH);
}

export async function computeEmbedding(content: string | string[]): Promise<number[][]> {
  const extractor = await pipeline("feature-extraction", MODEL_NAME);
  const embeddings = await extractor(content, { pooling: "mean", normalize: true });
  return embeddings.tolist();
}

export function getFileHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

// Main function
export async function generateIndex(): Promise<{ content: { type: "text"; text: string }[] }> {
  const oldEmbeddingData = await loadSearchIndex();
  const oldEmbeddingMap = new Map(oldEmbeddingData.map((entry) => [entry.path, entry]));

  const docFiles = await fs.readdir(AI_DOCS_DIR);
  const docFilePaths = docFiles.map((f) => path.join(AI_DOCS_DIR, f)).filter(fileHasSupportedExtension);

  const finalEmbeddingData: EmbeddingData[] = [];
  const filesToEmbed: { path: string; content: string }[] = [];
  let modifiedCount = 0;
  let addedCount = 0;

  for (const docFilePath of docFilePaths) {
    const content = await fs.readFile(docFilePath, "utf-8");
    const newHash = getFileHash(content);
    const oldEntry = oldEmbeddingMap.get(docFilePath);

    if (oldEntry) {
      if (newHash === oldEntry.hash) {
        finalEmbeddingData.push(oldEntry);
      } else {
        modifiedCount++;
        filesToEmbed.push({ path: docFilePath, content });
      }
      oldEmbeddingMap.delete(docFilePath);
    } else {
      addedCount++;
      filesToEmbed.push({ path: docFilePath, content });
    }
  }

  const deletedCount = oldEmbeddingMap.size;

  if (addedCount === 0 && modifiedCount === 0 && deletedCount === 0) {
    return { content: [{ type: "text", text: "No changes detected in documentation." }] };
  }

  if (filesToEmbed.length > 0) {
    const contents = filesToEmbed.map((f) => f.content);
    const newEmbeddings = await computeEmbedding(contents);

    filesToEmbed.forEach((file, i) => {
      const hash = getFileHash(file.content);
      finalEmbeddingData.push({ path: file.path, embedding: newEmbeddings[i], hash });
    });
  }

  await saveSearchIndex(finalEmbeddingData);

  return {
    content: [
      {
        type: "text",
        text: `Successfully indexed ${addedCount} new, ${modifiedCount} modified, and removed ${deletedCount} deleted document(s).`,
      },
    ],
  };
}

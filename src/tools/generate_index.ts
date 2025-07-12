import * as fs from "fs/promises";
import * as path from "path";
import { pipeline } from "@xenova/transformers";
import { createHash } from "crypto";
import { fileExists, logToFile } from "../utils.js";
import { EmbeddingData } from "../types.js";

export const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";
export const MIN_SIMILARITY_SCORE = 0.4;

export const AI_DOCS_DIR_NAME = "ai_docs";

const EMBEDDINGS_PATH = path.join("data", "embeddings.json");
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

export async function loadSearchIndex(projectRoot: string): Promise<EmbeddingData[]> {
  const embeddingsPath = path.join(projectRoot, EMBEDDINGS_PATH);
  return await loadJSON<EmbeddingData[]>(embeddingsPath);
}

async function saveSearchIndex(embeddingData: EmbeddingData[], projectRoot: string): Promise<string> {
  const embeddingsPath = path.join(projectRoot, EMBEDDINGS_PATH);
  const tempEmbeddingsPath = embeddingsPath + ".tmp";
  await fs.writeFile(tempEmbeddingsPath, JSON.stringify(embeddingData));
  await fs.rename(tempEmbeddingsPath, embeddingsPath);
  return embeddingsPath;
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
export async function generateIndex(projectRoot: string): Promise<{ content: { type: "text"; text: string }[] }> {
  const oldEmbeddingData = await loadSearchIndex(projectRoot);
  const oldEmbeddingMap = new Map(oldEmbeddingData.map((entry) => [entry.path, entry]));

  const aiFolderPath = path.join(projectRoot, AI_DOCS_DIR_NAME);
  if (!(await fileExists(aiFolderPath))) {
    return { content: [{ type: "text", text: `No documentation directory found. Path: ${aiFolderPath}` }] };
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
  const embeddingsPath2 = path.join(projectRoot, EMBEDDINGS_PATH); // TODO: remove this

  if (addedCount === 0 && modifiedCount === 0 && deletedCount === 0) {
    return {
      content: [
        {
          type: "text",
          text: `No changes detected in documentation.\nDocumentation path: ${aiFolderPath}\nEmbeddings path: ${embeddingsPath2}`,
        },
      ],
    };
  }

  if (filesToEmbed.length > 0) {
    const contents = filesToEmbed.map((f) => f.content);
    const newEmbeddings = await computeEmbedding(contents);

    filesToEmbed.forEach((file, i) => {
      const hash = getFileHash(file.content);
      finalEmbeddingData.push({ path: file.path, embedding: newEmbeddings[i], hash });
    });
  }

  const embeddingsPath = await saveSearchIndex(finalEmbeddingData, projectRoot);

  return {
    content: [
      {
        type: "text",
        text: `Successfully indexed ${addedCount} new, ${modifiedCount} modified, and removed ${deletedCount} deleted document(s).
        \nDocumentation path: ${aiFolderPath}
        \nEmbeddings path: ${embeddingsPath}`,
      },
    ],
  };
}

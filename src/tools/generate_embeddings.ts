import { pipeline } from "@xenova/transformers";
import * as fs from "fs/promises";
import * as path from "path";
import { AI_DOCS_DIR, EMBEDDINGS_PATH, getFileHash } from "./index.ts";

// AI model
const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";

// File extensions
export const SUPPORTED_FILE_EXTENSIONS = [".md"];

export const fileHasSupportedExtension = (file: string) => SUPPORTED_FILE_EXTENSIONS.some((ext) => file.endsWith(ext));

interface FileMetadata {
  path: string;
  content: string;
}

interface EmbeddingData {
  path: string;
  embedding: number[];
  hash: string;
}

// The main async function to run the process
async function generateEmbeddings() {
  // 1. Load the pre-trained model via a feature-extraction pipeline
  const extractor = await pipeline("feature-extraction", MODEL_NAME);

  try {
    // Ensure output directory exists
    await fs.mkdir(AI_DOCS_DIR, { recursive: true });

    // Filter out non-markdown files
    const files = (await fs.readdir(AI_DOCS_DIR))?.filter(fileHasSupportedExtension) ?? [];

    const fileData: FileMetadata[] = [];

    // Read all file contents
    for (const file of files) {
      const filePath = path.join(AI_DOCS_DIR, file);
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        const content = await fs.readFile(filePath, "utf-8");
        fileData.push({ path: filePath, content });
      }
    }

    // 2. Encode descriptions asynchronously
    const descriptions = fileData.map((f) => f.content);
    const output = await extractor(descriptions, { pooling: "mean", normalize: true });

    // 3. Store in memory
    const embeddings: number[][] = output.tolist();
    const embeddingData: EmbeddingData[] = fileData.map((f, i) => ({
      path: f.path,
      embedding: embeddings[i],
      hash: getFileHash(f.content),
    }));

    // Save the results to the output directory
    await fs.writeFile(EMBEDDINGS_PATH, JSON.stringify(embeddingData, null, 2));
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

generateEmbeddings()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

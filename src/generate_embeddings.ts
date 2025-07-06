import { pipeline } from "@xenova/transformers";
import * as fs from "fs/promises";
import * as path from "path";

// Paths
const AI_DOCS_DIR = "ai_docs";
const OUTPUT_DIR = "data";

// AI model
const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";

// File extensions
const SUPPORTED_FILE_EXTENSIONS = [".md"];

// Output file names
const OUTPUT_FILE_NAME = "embeddings.json";

interface FileMetadata {
  path: string;
  content: string;
}

interface EmbeddingData {
  path: string;
  embedding: number[];
}

// The main async function to run the process
async function generateEmbeddings() {
  console.log("Loading the model...");

  // 1. Load the pre-trained model via a feature-extraction pipeline
  const extractor = await pipeline("feature-extraction", MODEL_NAME);
  console.log("Model loaded successfully.");

  const docsPath = path.join(process.cwd(), AI_DOCS_DIR);
  const outputDir = path.join(process.cwd(), OUTPUT_DIR);

  try {
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Filter out non-markdown files
    const fileHasExtension = (file: string) => SUPPORTED_FILE_EXTENSIONS.some((ext) => file.endsWith(ext));
    const files = (await fs.readdir(docsPath)).filter(fileHasExtension);

    const fileData: FileMetadata[] = [];

    console.log(`Found ${files.length} files to process...`);

    // Read all file contents
    for (const file of files) {
      const filePath = path.join(docsPath, file);
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        const content = await fs.readFile(filePath, "utf-8");
        fileData.push({ path: filePath, content });
      }
    }

    // 2. Encode descriptions asynchronously
    console.log("Generating embeddings for all file descriptions...");
    const descriptions = fileData.map((f) => f.content);
    const output = await extractor(descriptions, { pooling: "mean", normalize: true });
    console.log("Embeddings generated successfully.");

    // 3. Store in memory
    const embeddings: number[][] = output.tolist();
    const embeddingData: EmbeddingData[] = fileData.map((f, i) => ({
      path: f.path,
      embedding: embeddings[i],
    }));

    // Verify the order and size
    console.log(`Successfully generated ${embeddings.length} embeddings.`);
    console.log("Shape of the first embedding:", embeddings[0]?.length);

    // Save the results to the output directory
    await fs.writeFile(path.join(outputDir, OUTPUT_FILE_NAME), JSON.stringify(embeddingData, null, 2));

    console.log(`Embeddings and metadata saved to ${outputDir}`);
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

// Run the main function
generateEmbeddings();

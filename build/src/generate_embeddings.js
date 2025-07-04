// 1. Load the model
import { pipeline } from "@xenova/transformers";
import * as fs from "fs/promises";
import * as path from "path";
// The main async function to run the process
async function generateEmbeddings() {
    console.log("Loading the model...");
    // 1. Load the pre-trained model via a feature-extraction pipeline
    const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    console.log("Model loaded successfully.");
    console.log("process.cwd()", process.cwd());
    console.log("ls", await fs.readdir(process.cwd()));
    // Path to the documents
    const docsPath = path.join(process.cwd(), "ai_docs");
    const outputDir = path.join(process.cwd(), "data");
    try {
        // Ensure output directory exists
        await fs.mkdir(outputDir, { recursive: true });
        // Filter out non-markdown files
        const files = (await fs.readdir(docsPath)).filter((file) => file.endsWith(".md"));
        const fileData = [];
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
        const embeddings = output.tolist();
        const fileMetadata = fileData.map((f) => ({ path: f.path })); // Keep only paths for metadata
        // Verify the order and size
        console.log(`Successfully generated ${embeddings.length} embeddings.`);
        console.log("Shape of the first embedding:", embeddings[0]?.length);
        // Save the results to the output directory
        await fs.writeFile(path.join(outputDir, "embeddings.json"), JSON.stringify(embeddings, null, 2));
        await fs.writeFile(path.join(outputDir, "file_metadata.json"), JSON.stringify(fileMetadata, null, 2));
        console.log(`Embeddings and metadata saved to ${outputDir}`);
    }
    catch (error) {
        console.error("An error occurred:", error);
    }
}
// Run the main function
generateEmbeddings();

import * as fs from "fs/promises";
import * as path from "path";
import * as utils from "../src/utils";

const { logToFile, fileExists, createFile, createDirectory, readDocumentationFile } = utils;

jest.mock("fs/promises");

describe("utils", () => {
  const mockCwd = "/home/user/project";
  const logsDir = path.join(mockCwd, "logs");
  const logFile = path.join(logsDir, "mcp.log");

  beforeAll(() => {
    jest.spyOn(process, "cwd").mockReturnValue(mockCwd);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("logToFile", () => {
    it("should create logs directory if it does not exist and append to log file", async () => {
      (fs.access as jest.Mock).mockRejectedValueOnce(new Error("ENOENT")); // logs dir doesn't exist
      (fs.appendFile as jest.Mock).mockResolvedValue(undefined);

      await logToFile("Test message");

      expect(fs.mkdir).toHaveBeenCalledWith(logsDir, { recursive: true });
      expect(fs.appendFile).toHaveBeenCalledWith(logFile, expect.stringContaining("Test message"));
    });

    it("should append to log file when logs directory already exists", async () => {
      (fs.access as jest.Mock).mockResolvedValue(true); // logs dir exists
      (fs.appendFile as jest.Mock).mockResolvedValue(undefined);

      await logToFile("Another test message");

      expect(fs.mkdir).not.toHaveBeenCalled();
      expect(fs.appendFile).toHaveBeenCalledWith(logFile, expect.stringContaining("Another test message"));
    });
  });

  describe("fileExists", () => {
    it("should return true if file exists", async () => {
      (fs.access as jest.Mock).mockResolvedValue(true);
      const result = await fileExists("/path/to/existing/file");
      expect(result).toBe(true);
    });

    it("should return false if file does not exist", async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error("ENOENT"));
      const result = await fileExists("/path/to/non/existing/file");
      expect(result).toBe(false);
    });
  });

  describe("createFile", () => {
    const filePath = "/path/to/new/file.txt";
    const content = "Hello, world!";

    it("should write file if it does not exist", async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error("ENOENT"));
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await createFile(filePath, content);

      expect(fs.writeFile).toHaveBeenCalledWith(filePath, content);
    });

    it("should not write file if it already exists", async () => {
      (fs.access as jest.Mock).mockResolvedValue(true);

      await createFile(filePath, content);

      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe("createDirectory", () => {
    const dirPath = "/path/to/new/directory";

    it("should create directory if it does not exist", async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error("ENOENT"));
      await createDirectory(dirPath);

      expect(fs.mkdir).toHaveBeenCalledWith(dirPath, { recursive: true });
    });

    it("should not create directory if it already exists", async () => {
      (fs.access as jest.Mock).mockResolvedValue(true);

      await createDirectory(dirPath);

      expect(fs.mkdir).not.toHaveBeenCalled();
    });
  });

  describe("readDocumentationFile", () => {
    const filePath = "/path/to/doc.md";
    const content = "This is a documentation file.";

    it("should return file content if file exists", async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(content);
      const result = await readDocumentationFile(filePath);
      expect(result).toBe(content);
      expect(fs.readFile).toHaveBeenCalledWith(filePath, "utf-8");
    });

    it("should return an empty string if file does not exist", async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error("ENOENT"));
      const result = await readDocumentationFile(filePath);
      expect(result).toBe("");
    });
  });
});

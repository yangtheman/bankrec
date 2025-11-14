import fs from "fs";
import path from "path";
import ConfigManager from "./config-manager";

// Mock electron app
jest.mock("electron", () => ({
  app: {
    getPath: jest.fn((name: string) => {
      if (name === "userData") {
        return "/tmp/bankrec-test";
      }
      if (name === "documents") {
        return "/tmp/documents";
      }
      return "/tmp";
    }),
  },
}));

describe("ConfigManager", () => {
  let configManager: ConfigManager;
  const testConfigPath = "/tmp/bankrec-test/config.json";

  beforeEach(() => {
    // Clean up any existing config file
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
    configManager = new ConfigManager();
  });

  afterEach(() => {
    // Clean up
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  describe("getDbPath", () => {
    it("should return default path when no custom path is set", () => {
      const dbPath = configManager.getDbPath();
      expect(dbPath).toContain("bankrec.db");
      expect(dbPath).toContain("/tmp/documents/BankRec");
    });

    it("should return custom path when set", () => {
      const customPath = "/tmp/custom-db-test/mydb.db";
      // Create directory for custom path
      const customDir = path.dirname(customPath);
      if (!fs.existsSync(customDir)) {
        fs.mkdirSync(customDir, { recursive: true });
      }

      configManager.setDbPath(customPath);
      const dbPath = configManager.getDbPath();
      expect(dbPath).toBe(customPath);

      // Clean up
      if (fs.existsSync(customDir)) {
        fs.rmSync(customDir, { recursive: true });
      }
    });
  });

  describe("setDbPath", () => {
    it("should successfully set a valid database path", () => {
      const customPath = "/tmp/test-db/bankrec.db";
      const result = configManager.setDbPath(customPath);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should create directory if it doesn't exist", () => {
      const customPath = "/tmp/new-test-dir/bankrec.db";
      const customDir = path.dirname(customPath);

      // Ensure directory doesn't exist
      if (fs.existsSync(customDir)) {
        fs.rmSync(customDir, { recursive: true });
      }

      const result = configManager.setDbPath(customPath);

      expect(result.success).toBe(true);
      expect(fs.existsSync(customDir)).toBe(true);

      // Clean up
      fs.rmSync(customDir, { recursive: true });
    });
  });

  describe("hasDbPath", () => {
    it("should return false when no custom path is set", () => {
      expect(configManager.hasDbPath()).toBe(false);
    });

    it("should return true when custom path is set", () => {
      const customPath = "/tmp/test-db/bankrec.db";
      configManager.setDbPath(customPath);

      expect(configManager.hasDbPath()).toBe(true);

      // Clean up
      const customDir = path.dirname(customPath);
      if (fs.existsSync(customDir)) {
        fs.rmSync(customDir, { recursive: true });
      }
    });
  });

  describe("getDbDir", () => {
    it("should return directory containing the database", () => {
      const customPath = "/tmp/test-db/bankrec.db";
      configManager.setDbPath(customPath);

      const dbDir = configManager.getDbDir();
      expect(dbDir).toBe("/tmp/test-db");

      // Clean up
      if (fs.existsSync(dbDir)) {
        fs.rmSync(dbDir, { recursive: true });
      }
    });
  });
});

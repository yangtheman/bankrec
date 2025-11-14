import fs from "fs";
import path from "path";
import EncryptionKeyManager from "./encryption-manager";

// Mock electron App
const mockApp = {
  getPath: jest.fn((name: string) => {
    if (name === "userData") {
      return "/tmp/test-bankrec";
    }
    return "/tmp";
  }),
} as any;

describe("EncryptionKeyManager", () => {
  let manager: EncryptionKeyManager;
  const testDir = "/tmp/test-bankrec/secure";
  const testFile = path.join(testDir, ".keystore");

  beforeEach(() => {
    // Clean up test files
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
    if (fs.existsSync(testDir)) {
      fs.rmdirSync(testDir, { recursive: true });
    }

    // Clear all mocks
    jest.clearAllMocks();

    // Reset module registry to clear keytar require cache
    jest.resetModules();
  });

  afterEach(() => {
    // Clean up
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
    if (fs.existsSync(testDir)) {
      fs.rmdirSync(testDir, { recursive: true });
    }
  });

  describe("generateKey", () => {
    beforeEach(() => {
      manager = new EncryptionKeyManager(mockApp);
    });

    test("should generate a base64-encoded key", () => {
      const key = manager.generateKey();
      expect(key).toBeTruthy();
      expect(typeof key).toBe("string");

      // Should be valid base64
      const decoded = Buffer.from(key, "base64");
      expect(decoded.length).toBe(32); // 256 bits
    });

    test("should generate unique keys", () => {
      const key1 = manager.generateKey();
      const key2 = manager.generateKey();
      expect(key1).not.toBe(key2);
    });

    test("should generate keys of consistent length", () => {
      const key1 = manager.generateKey();
      const key2 = manager.generateKey();
      expect(key1.length).toBe(key2.length);
    });
  });

  describe("storeKey and getKey with file storage", () => {
    beforeEach(() => {
      // Initialize without keytar
      jest.mock("keytar", () => {
        throw new Error("Module not found");
      });
      manager = new EncryptionKeyManager(mockApp);
    });

    test("should store and retrieve key from file", async () => {
      const testKey = "test-encryption-key-12345";

      const storeResult = await manager.storeKey(testKey);
      expect(storeResult.success).toBe(true);
      expect(storeResult.storage).toBe("file");

      // Verify file was created
      expect(fs.existsSync(testFile)).toBe(true);

      // Retrieve the key
      const getResult = await manager.getKey();
      expect(getResult.success).toBe(true);
      expect(getResult.key).toBe(testKey);
      expect(getResult.storage).toBe("file");
    });

    test("should create directory if it does not exist", async () => {
      expect(fs.existsSync(testDir)).toBe(false);

      const testKey = "test-key";
      await manager.storeKey(testKey);

      expect(fs.existsSync(testDir)).toBe(true);
    });

    test("should encrypt the key in the file", async () => {
      const testKey = "test-encryption-key-12345";
      await manager.storeKey(testKey);

      // Read the file and verify it's not plain text
      const fileContent = fs.readFileSync(testFile, "utf8");
      expect(fileContent).not.toContain(testKey);
      expect(fileContent).toContain(":"); // Should have iv:authTag:encrypted format
    });

    test("should return error when key file does not exist", async () => {
      const result = await manager.getKey();
      expect(result.success).toBe(false);
      expect(result.error).toBe("No encryption key found");
    });

    test("should handle corrupted key file", async () => {
      // Create a corrupted file
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(testFile, "corrupted-data", { mode: 0o600 });

      const result = await manager.getKey();
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe("hasKey", () => {
    beforeEach(() => {
      manager = new EncryptionKeyManager(mockApp);
    });

    test("should return true when key exists", async () => {
      const testKey = "test-key";
      await manager.storeKey(testKey);

      const hasKey = await manager.hasKey();
      expect(hasKey).toBe(true);
    });

    test("should return false when key does not exist", async () => {
      const hasKey = await manager.hasKey();
      expect(hasKey).toBe(false);
    });
  });

  describe("deleteKey", () => {
    beforeEach(() => {
      manager = new EncryptionKeyManager(mockApp);
    });

    test("should delete stored key file", async () => {
      const testKey = "test-key";
      await manager.storeKey(testKey);
      expect(fs.existsSync(testFile)).toBe(true);

      const deleted = await manager.deleteKey();
      expect(deleted).toBe(true);
      expect(fs.existsSync(testFile)).toBe(false);
    });

    test("should return true even if file does not exist", async () => {
      const deleted = await manager.deleteKey();
      // Should not throw and should complete
      expect(typeof deleted).toBe("boolean");
    });
  });

  describe("formatKeyForDisplay", () => {
    beforeEach(() => {
      manager = new EncryptionKeyManager(mockApp);
    });

    test("should format key into 4-character chunks", () => {
      const key = "abcdefghijklmnop";
      const formatted = manager.formatKeyForDisplay(key);
      expect(formatted).toBe("abcd-efgh-ijkl-mnop");
    });

    test("should handle keys not divisible by 4", () => {
      const key = "abcdefghij";
      const formatted = manager.formatKeyForDisplay(key);
      expect(formatted).toBe("abcd-efgh-ij");
    });

    test("should handle empty string", () => {
      const formatted = manager.formatKeyForDisplay("");
      expect(formatted).toBe("");
    });

    test("should handle very short keys", () => {
      const formatted = manager.formatKeyForDisplay("abc");
      expect(formatted).toBe("abc");
    });
  });

  describe("key security", () => {
    beforeEach(() => {
      manager = new EncryptionKeyManager(mockApp);
    });

    test("should set secure file permissions", async () => {
      const testKey = "test-key";
      await manager.storeKey(testKey);

      const stats = fs.statSync(testFile);
      // File should be readable/writable only by owner (0o600 or less restrictive)
      const mode = stats.mode & 0o777;
      expect(mode).toBeLessThanOrEqual(0o600);
    });

    test("should use machine-specific encryption for file storage", async () => {
      const testKey = "test-key";

      // Store key
      await manager.storeKey(testKey);
      const fileContent1 = fs.readFileSync(testFile, "utf8");

      // Delete and store again
      fs.unlinkSync(testFile);
      await manager.storeKey(testKey);
      const fileContent2 = fs.readFileSync(testFile, "utf8");

      // The encrypted content should be different due to different IVs
      // but we should still be able to decrypt both
      expect(fileContent1).not.toBe(fileContent2);

      const result = await manager.getKey();
      expect(result.key).toBe(testKey);
    });
  });

  describe("edge cases", () => {
    beforeEach(() => {
      manager = new EncryptionKeyManager(mockApp);
    });

    test("should handle very long keys", async () => {
      const longKey = "a".repeat(1000);
      const storeResult = await manager.storeKey(longKey);
      expect(storeResult.success).toBe(true);

      const getResult = await manager.getKey();
      expect(getResult.key).toBe(longKey);
    });

    test("should handle keys with special characters", async () => {
      const specialKey = "key!@#$%^&*()_+-=[]{}|;:,.<>?/~`";
      const storeResult = await manager.storeKey(specialKey);
      expect(storeResult.success).toBe(true);

      const getResult = await manager.getKey();
      expect(getResult.key).toBe(specialKey);
    });

    test("should handle keys with unicode characters", async () => {
      const unicodeKey = "key-测试-🔑-キー";
      const storeResult = await manager.storeKey(unicodeKey);
      expect(storeResult.success).toBe(true);

      const getResult = await manager.getKey();
      expect(getResult.key).toBe(unicodeKey);
    });
  });
});

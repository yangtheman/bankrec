import crypto from "crypto";
import { App } from "electron";
import fs from "fs";
import os from "os";
import path from "path";

interface KeyResult {
  success: boolean;
  key?: string;
  storage?: string;
  error?: string;
}

interface Keytar {
  setPassword(
    service: string,
    account: string,
    password: string
  ): Promise<void>;
  getPassword(service: string, account: string): Promise<string | null>;
  deletePassword(service: string, account: string): Promise<boolean>;
}

/**
 * EncryptionKeyManager
 * Handles generation and secure storage of encryption keys
 * Stores keys in the system keychain (or encrypted file as fallback)
 */
class EncryptionKeyManager {
  private app: App;
  private keytar: Keytar | null;
  private SERVICE_NAME: string;
  private ACCOUNT_NAME: string;
  private FALLBACK_DIR: string;
  private FALLBACK_FILE: string;

  constructor(app: App) {
    this.app = app;
    this.keytar = null;
    this.SERVICE_NAME = "BankRec";
    this.ACCOUNT_NAME = "encryption-key";
    this.FALLBACK_DIR = path.join(app.getPath("userData"), "secure");
    this.FALLBACK_FILE = path.join(this.FALLBACK_DIR, ".keystore");

    // Try to load keytar for secure keychain storage
    try {
      this.keytar = require("keytar");
    } catch (err) {
      console.warn(
        "Keytar not available, using encrypted file storage as fallback"
      );
    }
  }

  /**
   * Generate a strong random encryption key
   * Returns a base64-encoded 256-bit key
   */
  generateKey(): string {
    // Generate 32 bytes (256 bits) of random data
    const keyBuffer = crypto.randomBytes(32);
    // Convert to base64 for easy storage and display
    return keyBuffer.toString("base64");
  }

  /**
   * Store the encryption key securely
   * Uses system keychain if available, otherwise encrypted file
   */
  async storeKey(encryptionKey: string): Promise<KeyResult> {
    if (this.keytar) {
      // Store in system keychain
      try {
        await this.keytar.setPassword(
          this.SERVICE_NAME,
          this.ACCOUNT_NAME,
          encryptionKey
        );
        return { success: true, storage: "keychain" };
      } catch (err) {
        console.error("Failed to store key in keychain:", err);
        // Fall back to file storage
        return this.storeKeyInFile(encryptionKey);
      }
    } else {
      // Use encrypted file storage
      return this.storeKeyInFile(encryptionKey);
    }
  }

  /**
   * Store key in an encrypted file (fallback method)
   */
  private storeKeyInFile(encryptionKey: string): KeyResult {
    try {
      // Ensure directory exists
      if (!fs.existsSync(this.FALLBACK_DIR)) {
        fs.mkdirSync(this.FALLBACK_DIR, { recursive: true, mode: 0o700 });
      }

      // Generate a machine-specific encryption key using hardware info
      const machineId = this.getMachineId();
      const fileEncryptionKey = crypto.scryptSync(
        machineId,
        "bankrec-salt",
        32
      );

      // Encrypt the encryption key (yes, encrypt the encryptor!)
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        fileEncryptionKey,
        iv
      ) as crypto.CipherGCM;

      let encrypted = cipher.update(encryptionKey, "utf8", "hex");
      encrypted += cipher.final("hex");

      const authTag = cipher.getAuthTag();

      // Store iv:authTag:encrypted
      const data =
        iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted;

      fs.writeFileSync(this.FALLBACK_FILE, data, { mode: 0o600 });

      return { success: true, storage: "file" };
    } catch (err) {
      console.error("Failed to store key in file:", err);
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Retrieve the stored encryption key
   */
  async getKey(): Promise<KeyResult> {
    if (this.keytar) {
      // Try to get from keychain first
      try {
        const key = await this.keytar.getPassword(
          this.SERVICE_NAME,
          this.ACCOUNT_NAME
        );
        if (key) {
          return { success: true, key, storage: "keychain" };
        }
      } catch (err) {
        console.error("Failed to retrieve key from keychain:", err);
      }
    }

    // Fall back to file storage
    return this.getKeyFromFile();
  }

  /**
   * Retrieve key from encrypted file
   */
  private getKeyFromFile(): KeyResult {
    try {
      if (!fs.existsSync(this.FALLBACK_FILE)) {
        return { success: false, error: "No encryption key found" };
      }

      const data = fs.readFileSync(this.FALLBACK_FILE, "utf8");
      const parts = data.split(":");

      if (parts.length !== 3) {
        return { success: false, error: "Invalid key file format" };
      }

      const iv = Buffer.from(parts[0], "hex");
      const authTag = Buffer.from(parts[1], "hex");
      const encrypted = parts[2];

      // Generate same machine-specific key
      const machineId = this.getMachineId();
      const fileEncryptionKey = crypto.scryptSync(
        machineId,
        "bankrec-salt",
        32
      );

      // Decrypt
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        fileEncryptionKey,
        iv
      ) as crypto.DecipherGCM;
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return { success: true, key: decrypted, storage: "file" };
    } catch (err) {
      console.error("Failed to retrieve key from file:", err);
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Check if an encryption key exists
   */
  async hasKey(): Promise<boolean> {
    const result = await this.getKey();
    return result.success;
  }

  /**
   * Delete the stored encryption key (for reset/cleanup)
   */
  async deleteKey(): Promise<boolean> {
    let deleted = false;

    if (this.keytar) {
      try {
        deleted = await this.keytar.deletePassword(
          this.SERVICE_NAME,
          this.ACCOUNT_NAME
        );
      } catch (err) {
        console.error("Failed to delete key from keychain:", err);
      }
    }

    // Also delete file if it exists
    if (fs.existsSync(this.FALLBACK_FILE)) {
      try {
        fs.unlinkSync(this.FALLBACK_FILE);
        deleted = true;
      } catch (err) {
        console.error("Failed to delete key file:", err);
      }
    }

    return deleted;
  }

  /**
   * Get a machine-specific identifier for file encryption
   * Uses a combination of OS-specific values
   * Note: os.hostname() is intentionally excluded as it can change on macOS
   * with DHCP, which would make the encrypted key file unreadable
   */
  private getMachineId(): string {
    // Combine multiple machine attributes (excluding hostname for stability)
    const components = [
      os.platform(),
      os.arch(),
      os.homedir(),
      this.app.getPath("userData"),
    ];

    // Create a hash of these components
    const hash = crypto.createHash("sha256");
    hash.update(components.join("|"));
    return hash.digest("hex");
  }

  /**
   * Format the encryption key for display to user
   * Returns the key split into 4-character chunks for readability
   */
  formatKeyForDisplay(key: string): string {
    // Split into groups of 4 characters
    const matches = key.match(/.{1,4}/g);
    return matches ? matches.join("-") : key;
  }
}

export default EncryptionKeyManager;

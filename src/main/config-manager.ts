import { app } from "electron";
import fs from "fs";
import path from "path";

interface AppConfig {
  dbPath?: string;
  version?: string;
}

class ConfigManager {
  private configPath: string;
  private config: AppConfig;

  constructor() {
    const userDataPath = app.getPath("userData");
    this.configPath = path.join(userDataPath, "config.json");
    this.config = this.loadConfig();
  }

  /**
   * Load configuration from disk or create default
   */
  private loadConfig(): AppConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, "utf8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error("Error loading config:", error);
    }

    // Return default config
    return {
      version: "1.0.0",
    };
  }

  /**
   * Save configuration to disk
   */
  private saveConfig(): boolean {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), {
        encoding: "utf8",
      });
      return true;
    } catch (error) {
      console.error("Error saving config:", error);
      return false;
    }
  }

  /**
   * Get the configured database path or return default
   */
  getDbPath(): string {
    if (this.config.dbPath && fs.existsSync(path.dirname(this.config.dbPath))) {
      return this.config.dbPath;
    }

    // Default path - use Documents folder
    const documentsDir = app.getPath("documents");
    const dataDir = path.join(documentsDir, "BankRec");
    return path.join(dataDir, "bankrec.db");
  }

  /**
   * Set the database path
   */
  setDbPath(dbPath: string): { success: boolean; error?: string } {
    try {
      // Validate path
      const dir = path.dirname(dbPath);

      // Ensure directory exists
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Check if directory is writable
      fs.accessSync(dir, fs.constants.W_OK);

      this.config.dbPath = dbPath;
      const saved = this.saveConfig();

      if (!saved) {
        return { success: false, error: "Failed to save configuration" };
      }

      return { success: true };
    } catch (error: any) {
      console.error("Error setting database path:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if database path is configured
   */
  hasDbPath(): boolean {
    return !!this.config.dbPath;
  }

  /**
   * Get the directory containing the database
   */
  getDbDir(): string {
    return path.dirname(this.getDbPath());
  }
}

export default ConfigManager;

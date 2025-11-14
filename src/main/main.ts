import crypto from "crypto";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import fs from "fs";
import path from "path";
import {
  RateLimiter,
  validateFilePath,
  validateTransactionData,
  validateUserData,
} from "../renderer/validation";
import ConfigManager from "./config-manager";
import EncryptedDatabase from "./db";
import EncryptionKeyManager from "./encryption-manager";

let mainWindow: BrowserWindow | null;
let db: EncryptedDatabase | null;
let encryptionKeyManager: EncryptionKeyManager;
let configManager: ConfigManager;

// Rate limiters for API protection
const exportRateLimiter = new RateLimiter(5, 300000); // 5 exports per 5 minutes

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, "../../assets/app_logo.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      allowRunningInsecureContent: false,
      webSecurity: true,
      preload: path.join(__dirname, "../preload/preload.js"),
    },
  });

  mainWindow.loadFile(path.join(__dirname, "../../src/views/index.html"));

  // Security: Prevent navigation to external URLs
  mainWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.origin !== "file://") {
      event.preventDefault();
    }
  });

  // Security: Prevent opening new windows
  mainWindow.webContents.setWindowOpenHandler(() => {
    // Prevent opening new windows
    return { action: "deny" };
  });

  // Open DevTools in development only
  if (process.env.NODE_ENV === "development" || !app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
}

// Initialize database with retry logic
async function initializeDatabase(retryCount = 0): Promise<boolean> {
  const maxRetries = 3;
  const retryDelay = 500; // 500ms between retries

  try {
    // Get or wait for encryption key
    const keyResult = await encryptionKeyManager.getKey();
    if (!keyResult.success || !keyResult.key) {
      // Retry if within retry limit
      if (retryCount < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        return initializeDatabase(retryCount + 1);
      }

      console.error(
        "Database initialization failed: No encryption key after retries"
      );
      return false;
    }

    const dbPath = configManager.getDbPath();
    db = new EncryptedDatabase(dbPath, keyResult.key);
    return true;
  } catch (error) {
    console.error(
      `Database initialization error (attempt ${retryCount + 1}):`,
      error
    );

    // Retry on error if within retry limit
    if (retryCount < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      return initializeDatabase(retryCount + 1);
    }

    return false;
  }
}

// Initialize config manager
configManager = new ConfigManager();

// Ensure data directory exists
const dbPath = configManager.getDbPath();
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// IPC Handlers for Database Operations
ipcMain.handle("save-data", async (_event, data: any) => {
  try {
    if (!db) {
      return { success: false, error: "Database not initialized" };
    }

    // Save user if provided
    if (data.user && data.user.email) {
      // Validate and sanitize user data
      let validatedUser: any;
      try {
        validatedUser = validateUserData(data.user);
      } catch (validationError: any) {
        return {
          success: false,
          error: `Invalid user data: ${validationError.message}`,
        };
      }

      const existingUser = db.getUserByEmail(validatedUser.email);
      if (!existingUser) {
        const userId = db.createUser(
          validatedUser.email,
          validatedUser.firstName,
          validatedUser.lastName,
          null
        );
        data.user.id = userId;
        // Initialize default categories for new user
        db.initializeDefaultCategories(userId);
      } else if (existingUser) {
        data.user.id = existingUser.id;
        // Update user profile fields if provided
        if (validatedUser.firstName || validatedUser.lastName) {
          db.updateUser(existingUser.id, {
            firstName: validatedUser.firstName,
            lastName: validatedUser.lastName,
          });
        }
      }
    }

    // Save categories
    if (data.categories && data.user && data.user.id) {
      // Get existing categories
      const existingCategories = db.getCategoriesByUserId(data.user.id);
      const existingNames = new Set(
        existingCategories.map((c: any) => `${c.type}:${c.name}`)
      );

      // Add new custom categories (non-default ones)
      for (const [type, categoryList] of Object.entries(data.categories)) {
        for (const categoryName of categoryList as string[]) {
          const key = `${type}:${categoryName}`;
          if (!existingNames.has(key)) {
            try {
              db.createCategory(data.user.id, categoryName, type, false);
            } catch (err: any) {
              // Ignore duplicates
              console.error(
                `Failed to save category ${categoryName}:`,
                err.message
              );
            }
          }
        }
      }
    }

    // Save transactions
    if (data.transactions && Array.isArray(data.transactions)) {
      for (const transaction of data.transactions) {
        try {
          // Map frontend fields to database fields
          const description = transaction.payee || transaction.description;
          const isReconciled =
            transaction.reconciled !== undefined
              ? transaction.reconciled
              : transaction.isReconciled;

          // Prepare transaction object for validation
          const transactionToValidate = {
            id: transaction.id,
            date: transaction.date,
            description: description,
            amount: transaction.amount,
            type: transaction.type,
            category: transaction.category,
            isReconciled: isReconciled,
            accountId: transaction.accountId,
          };

          // Validate transaction data
          let validatedTransaction: any;
          try {
            validatedTransaction = validateTransactionData(
              transactionToValidate
            );
          } catch (validationError: any) {
            console.error(
              "Transaction validation error:",
              validationError.message
            );
            continue; // Skip invalid transactions
          }

          // Check if transaction exists
          const existing = db
            .getTransactionsByUserId(data.user.id)
            .find((t: any) => t.id === validatedTransaction.id);
          if (existing) {
            db.updateTransaction(validatedTransaction.id, {
              description: validatedTransaction.description,
              amount: validatedTransaction.amount,
              category: validatedTransaction.category,
              isReconciled: validatedTransaction.isReconciled,
            });
          } else {
            // Create new transaction - DB will generate UUID
            db.createTransaction({
              userId: data.user.id,
              date: validatedTransaction.date,
              description: validatedTransaction.description,
              amount: validatedTransaction.amount,
              type: validatedTransaction.type,
              category: validatedTransaction.category,
              checkNumber: validatedTransaction.checkNumber,
              isReconciled: validatedTransaction.isReconciled,
              accountId: validatedTransaction.accountId,
            });
          }
        } catch (err: any) {
          console.error("Transaction save error:", err.message);
        }
      }
    }

    return { success: true, user: data.user };
  } catch (error: any) {
    console.error("Save error:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("load-data", async (_event, email?: string) => {
  try {
    // Retry database initialization if it's not ready
    if (!db) {
      const initialized = await initializeDatabase();

      if (!initialized || !db) {
        console.error("Failed to initialize database on load-data request");
        return {
          success: false,
          error: "Database not initialized. Please complete onboarding.",
        };
      }
    }

    // Get user by email if provided, otherwise get the first user
    let user = null;
    if (email) {
      user = db.getUserByEmail(email);
    } else {
      user = db.getFirstUser();
    }

    if (!user) {
      return { success: true, data: null };
    }

    const transactions = db.getTransactionsByUserId(user.id).map((t: any) => ({
      id: t.id,
      date: t.date,
      payee: t.description, // Map description to payee for frontend
      description: t.description, // Keep for compatibility
      amount: t.amount,
      type: t.type,
      category: t.category,
      reconciled: t.is_reconciled === 1, // Map to reconciled for frontend
      isReconciled: t.is_reconciled === 1, // Keep for compatibility
      accountId: t.account_id,
      checkNumber: t.check_number || null,
      source: "manual",
    }));

    // Load categories
    const dbCategories = db.getCategoriesByUserId(user.id);
    const categories: { income: string[]; expense: string[] } = {
      income: [],
      expense: [],
    };

    dbCategories.forEach((cat: any) => {
      if (cat.type === "income") {
        categories.income.push(cat.name);
      } else if (cat.type === "expense") {
        categories.expense.push(cat.name);
      }
    });

    // If no categories exist, initialize defaults
    if (categories.income.length === 0 && categories.expense.length === 0) {
      db.initializeDefaultCategories(user.id);
      const defaultCategories = db.getCategoriesByUserId(user.id);
      defaultCategories.forEach((cat: any) => {
        if (cat.type === "income") {
          categories.income.push(cat.name);
        } else if (cat.type === "expense") {
          categories.expense.push(cat.name);
        }
      });
    }

    const data = {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
      },
      transactions,
      categories,
      bankConnected: false,
    };

    return { success: true, data };
  } catch (error: any) {
    console.error("Load error:", error);
    return { success: false, error: error.message };
  }
});

// Encryption Key Management IPC Handlers
ipcMain.handle("encryption:generate-key", async () => {
  try {
    if (!encryptionKeyManager) {
      return {
        success: false,
        error: "Encryption key manager not initialized",
      };
    }

    const key = encryptionKeyManager.generateKey();
    return { success: true, key };
  } catch (error: any) {
    console.error("Error generating encryption key:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("encryption:store-key", async (_event, key: string) => {
  try {
    if (!encryptionKeyManager) {
      return {
        success: false,
        error: "Encryption key manager not initialized",
      };
    }

    const result = await encryptionKeyManager.storeKey(key);

    if (result.success) {
      // Now initialize the database with the new key
      const dbInitialized = await initializeDatabase();

      if (!dbInitialized) {
        return {
          success: false,
          error: "Failed to initialize database with encryption key",
        };
      }
    }

    return result;
  } catch (error: any) {
    console.error("Error storing encryption key:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("encryption:has-key", async () => {
  try {
    if (!encryptionKeyManager) {
      return {
        success: false,
        error: "Encryption key manager not initialized",
      };
    }

    const hasKey = await encryptionKeyManager.hasKey();
    return { success: true, hasKey };
  } catch (error: any) {
    console.error("Error checking encryption key:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("encryption:format-key", async (_event, key: string) => {
  try {
    if (!encryptionKeyManager) {
      return {
        success: false,
        error: "Encryption key manager not initialized",
      };
    }

    const formatted = encryptionKeyManager.formatKeyForDisplay(key);
    return { success: true, formatted };
  } catch (error: any) {
    console.error("Error formatting encryption key:", error);
    return { success: false, error: error.message };
  }
});

// Database Path Configuration IPC Handlers
ipcMain.handle("db:get-path", async () => {
  try {
    if (!configManager) {
      return {
        success: false,
        error: "Configuration manager not initialized",
      };
    }

    const dbPath = configManager.getDbPath();
    const hasCustomPath = configManager.hasDbPath();
    return { success: true, path: dbPath, hasCustomPath };
  } catch (error: any) {
    console.error("Error getting database path:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("db:choose-path", async () => {
  try {
    if (!mainWindow) {
      return { success: false, error: "Main window not available" };
    }

    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Choose Database Location",
      defaultPath: "bankrec.db",
      filters: [{ name: "Database Files", extensions: ["db"] }],
      properties: ["createDirectory", "showOverwriteConfirmation"],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: "No path selected" };
    }

    return { success: true, path: result.filePath };
  } catch (error: any) {
    console.error("Error choosing database path:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("db:set-path", async (_event, dbPath: string) => {
  try {
    if (!configManager) {
      return {
        success: false,
        error: "Configuration manager not initialized",
      };
    }

    // Validate the path
    if (!dbPath || typeof dbPath !== "string") {
      return { success: false, error: "Invalid path provided" };
    }

    const result = configManager.setDbPath(dbPath);
    return result;
  } catch (error: any) {
    console.error("Error setting database path:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("db:change-path", async (_event, newDbPath: string) => {
  try {
    if (!configManager || !db) {
      return {
        success: false,
        error: "System not initialized",
      };
    }

    // Validate the new path
    if (!newDbPath || typeof newDbPath !== "string") {
      return { success: false, error: "Invalid path provided" };
    }

    const oldDbPath = configManager.getDbPath();

    // Check if old database exists
    if (fs.existsSync(oldDbPath)) {
      // Copy the database to new location
      const newDir = path.dirname(newDbPath);
      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true });
      }
      fs.copyFileSync(oldDbPath, newDbPath);
    }

    // Update configuration
    const result = configManager.setDbPath(newDbPath);
    if (!result.success) {
      return result;
    }

    // Close and reinitialize database with new path
    db.close();
    await initializeDatabase();

    return { success: true, oldPath: oldDbPath, newPath: newDbPath };
  } catch (error: any) {
    console.error("Error changing database path:", error);
    // Try to reinitialize with old path on error
    try {
      await initializeDatabase();
    } catch (reinitError) {
      console.error("Failed to reinitialize database:", reinitError);
    }
    return { success: false, error: error.message };
  }
});

// Helper function to encrypt file data
function encryptFileData(data: Buffer, password: string): Buffer {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    key,
    iv
  ) as crypto.CipherGCM;

  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Return: salt(16) + iv(16) + authTag(16) + encrypted data
  return Buffer.concat([salt, iv, authTag, encrypted]);
}

// Helper function to decrypt file data
function decryptFileData(encryptedData: Buffer, password: string): Buffer {
  const salt = encryptedData.slice(0, 16);
  const iv = encryptedData.slice(16, 32);
  const authTag = encryptedData.slice(32, 48);
  const encrypted = encryptedData.slice(48);

  const key = crypto.scryptSync(password, salt, 32);
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    iv
  ) as crypto.DecipherGCM;
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

ipcMain.handle(
  "export-data",
  async (_event, exportPath: string, password: string) => {
    try {
      if (!db) {
        return { success: false, error: "Database not initialized" };
      }

      // Rate limiting
      if (!exportRateLimiter.check("export")) {
        return {
          success: false,
          error: "Too many export requests. Please wait and try again.",
        };
      }

      // Validate file path
      try {
        validateFilePath(exportPath);
      } catch (validationError: any) {
        return {
          success: false,
          error: `Invalid file path: ${validationError.message}`,
        };
      }

      // Validate password strength
      if (!password || typeof password !== "string" || password.length < 8) {
        return {
          success: false,
          error: "Password must be at least 8 characters long",
        };
      }

      // Create a temporary backup
      const dataDir = configManager.getDbDir();
      const tempPath = path.join(dataDir, "temp-export.db");
      await db.backup(tempPath);

      // Read the database file
      const dbData = fs.readFileSync(tempPath);

      // Encrypt the data with the provided password
      const encryptedData = encryptFileData(dbData, password);

      // Write encrypted data to export file
      fs.writeFileSync(exportPath, encryptedData);

      // Clean up temp file
      fs.unlinkSync(tempPath);

      return { success: true };
    } catch (error: any) {
      console.error("Export error occurred");
      return { success: false, error: "Export failed. Please try again." };
    }
  }
);

ipcMain.handle(
  "import-data",
  async (_event, importPath: string, password: string) => {
    try {
      // Validate file path
      try {
        validateFilePath(importPath);
      } catch (validationError: any) {
        return {
          success: false,
          error: `Invalid file path: ${validationError.message}`,
        };
      }

      if (!fs.existsSync(importPath)) {
        return { success: false, error: "Import file not found" };
      }

      // Validate password
      if (!password || typeof password !== "string") {
        return { success: false, error: "Password is required" };
      }

      // Check file size (prevent loading extremely large files)
      const stats = fs.statSync(importPath);
      if (stats.size > 100 * 1024 * 1024) {
        // 100MB limit
        return {
          success: false,
          error: "Import file is too large (max 100MB)",
        };
      }

      // Read the encrypted file
      const encryptedData = fs.readFileSync(importPath);

      // Try to decrypt the data
      let dbData: Buffer;
      try {
        dbData = decryptFileData(encryptedData, password);
      } catch (decryptError) {
        return {
          success: false,
          error: "Incorrect password or corrupted file",
        };
      }

      // Close current database
      if (db) {
        db.close();
      }

      // Write decrypted data to database file
      const dbPath = configManager.getDbPath();
      fs.writeFileSync(dbPath, dbData);

      // Reinitialize database
      await initializeDatabase();

      return { success: true };
    } catch (error: any) {
      console.error("Import error occurred");

      // Try to reinitialize the old database if import failed
      try {
        await initializeDatabase();
      } catch (reinitError) {
        console.error("Failed to reinitialize database");
      }

      return {
        success: false,
        error: "Import failed. Please check your file and password.",
      };
    }
  }
);

ipcMain.handle("dialog:openFile", async () => {
  if (!mainWindow) return { success: false };
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [{ name: "BankRec Database", extensions: ["db"] }],
  });

  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return { success: false };
  }

  return { success: true, filePath: result.filePaths[0] };
});

ipcMain.handle("dialog:saveFile", async () => {
  if (!mainWindow) return { success: false };
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: "BankRec Database", extensions: ["db"] }],
    defaultPath: "bankrec-backup.db",
  });

  if (result.canceled || !result.filePath) {
    return { success: false };
  }

  return { success: true, filePath: result.filePath };
});

ipcMain.handle("dialog:openCsvFile", async () => {
  if (!mainWindow) return { success: false };
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [
        { name: "CSV Files", extensions: ["csv"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false };
    }

    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, "utf-8");

    return { success: true, content, filePath };
  } catch (error: any) {
    console.error("CSV file open error:", error);
    return { success: false, error: error.message };
  }
});

// Update Transaction
ipcMain.handle(
  "update-transaction",
  async (_event, transactionId: string, updates: any) => {
    try {
      if (!db) {
        return { success: false, error: "Database not initialized" };
      }

      db.updateTransaction(transactionId, updates);
      return { success: true };
    } catch (error: any) {
      console.error("Update transaction error:", error);
      return { success: false, error: error.message };
    }
  }
);

// Delete Transaction
ipcMain.handle("delete-transaction", async (_event, transactionId: string) => {
  try {
    if (!db) {
      return { success: false, error: "Database not initialized" };
    }

    db.deleteTransaction(transactionId);
    return { success: true };
  } catch (error: any) {
    console.error("Delete transaction error:", error);
    return { success: false, error: error.message };
  }
});

// Reconciliation handlers
ipcMain.handle(
  "db:find-unreconciled-by-amount",
  async (
    _event,
    userId: number,
    amount: number,
    dateFrom: string | null,
    dateTo: string | null
  ) => {
    try {
      if (!db) {
        return { success: false, error: "Database not initialized" };
      }

      const transactions = db.findUnreconciledTransactionsByAmount(
        userId,
        amount,
        dateFrom,
        dateTo
      );
      return { success: true, transactions };
    } catch (error: any) {
      console.error("Error finding unreconciled transactions:", error);
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle(
  "db:find-by-amount",
  async (
    _event,
    userId: number,
    amount: number,
    dateFrom: string | null,
    dateTo: string | null
  ) => {
    try {
      if (!db) {
        return { success: false, error: "Database not initialized" };
      }

      const transactions = db.findTransactionsByAmount(
        userId,
        amount,
        dateFrom,
        dateTo
      );
      return { success: true, transactions };
    } catch (error: any) {
      console.error("Error finding transactions by amount:", error);
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle(
  "db:mark-reconciled",
  async (_event, transactionId: string, isReconciled: boolean) => {
    try {
      if (!db) {
        return { success: false, error: "Database not initialized" };
      }

      db.markTransactionReconciled(transactionId, isReconciled);
      return { success: true };
    } catch (error: any) {
      console.error("Error marking transaction as reconciled:", error);
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle("db:get-unreconciled", async (_event, userId: number) => {
  try {
    if (!db) {
      return { success: false, error: "Database not initialized" };
    }

    const transactions = db.getUnreconciledTransactionsByUserId(userId);
    return { success: true, transactions };
  } catch (error: any) {
    console.error("Error getting unreconciled transactions:", error);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(async () => {
  // Initialize encryption key manager
  encryptionKeyManager = new EncryptionKeyManager(app);

  // Try to initialize database (will succeed if encryption key exists)
  await initializeDatabase();

  createWindow();
});

app.on("window-all-closed", () => {
  // On macOS, don't close the database when window closes
  // The app stays running in the dock
  if (process.platform !== "darwin") {
    if (db) {
      db.close();
    }
    app.quit();
  }
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    // Ensure database is initialized when reopening window on macOS
    if (!db) {
      await initializeDatabase();
    }
    createWindow();
  }
});

app.on("before-quit", () => {
  if (db) {
    db.close();
  }
});

import Database from "better-sqlite3";
import crypto from "crypto";
import fs from "fs";
import path from "path";

interface TransactionInput {
  userId: number;
  date: string;
  description: string;
  amount: number;
  type: string;
  category?: string | null;
  checkNumber?: string | null;
  isReconciled?: boolean;
  accountId?: string | null;
}

interface TransactionUpdate {
  date?: string;
  description?: string;
  amount?: number;
  type?: string;
  category?: string | null;
  checkNumber?: string | null;
  isReconciled?: boolean;
}

interface UserUpdate {
  firstName?: string | null;
  lastName?: string | null;
  address?: string | null;
  email?: string;
}

class EncryptedDatabase {
  private db: Database.Database;
  private algorithm: string;
  private key: Buffer;

  constructor(dbPath: string, encryptionKey: string) {
    // Ensure the directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Derive encryption components
    const keyMaterial = crypto.scryptSync(encryptionKey, "salt", 32);
    this.algorithm = "aes-256-gcm";
    this.key = keyMaterial;

    // Open database
    this.db = new Database(dbPath);

    // Enable Write-Ahead Logging for better performance and concurrency
    this.db.pragma("journal_mode = WAL");

    // Enable foreign keys
    this.db.pragma("foreign_keys = ON");

    this.initializeTables();
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  encrypt(text: string | null): string | null {
    if (!text) return null;

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      this.algorithm,
      this.key,
      iv
    ) as crypto.CipherGCM;

    let encrypted = cipher.update(String(text), "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    // Return iv:authTag:encrypted format
    return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted;
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(text: string | null): string | null {
    if (!text) return null;

    try {
      const parts = text.split(":");
      if (parts.length !== 3) return text; // Not encrypted, return as-is

      const iv = Buffer.from(parts[0], "hex");
      const authTag = Buffer.from(parts[1], "hex");
      const encrypted = parts[2];

      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.key,
        iv
      ) as crypto.DecipherGCM;
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (err) {
      console.error("Decryption error:", (err as Error).message);
      return null;
    }
  }

  private initializeTables(): void {
    // Create users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        first_name TEXT,
        last_name TEXT,
        address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create transactions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL,
        category TEXT,
        check_number TEXT,
        is_reconciled INTEGER DEFAULT 0,
        account_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Migrate existing databases - add check_number column if it doesn't exist
    try {
      this.db.exec(`ALTER TABLE transactions ADD COLUMN check_number TEXT`);
    } catch (err) {
      // Column already exists, ignore error
    }

    // Create categories table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        is_default INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, name, type)
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
      CREATE INDEX IF NOT EXISTS idx_transactions_amount ON transactions(amount);
      CREATE INDEX IF NOT EXISTS idx_transactions_description ON transactions(description);
      CREATE INDEX IF NOT EXISTS idx_transactions_is_reconciled ON transactions(is_reconciled);
      CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
    `);
  }

  // User operations
  createUser(
    email: string,
    firstName: string | null = null,
    lastName: string | null = null,
    address: string | null = null
  ): number {
    const stmt = this.db.prepare(
      "INSERT INTO users (email, first_name, last_name, address) VALUES (?, ?, ?, ?)"
    );
    const result = stmt.run(email, firstName, lastName, address);
    return result.lastInsertRowid as number;
  }

  getUserByEmail(email: string): any {
    const stmt = this.db.prepare("SELECT * FROM users WHERE email = ?");
    return stmt.get(email);
  }

  getUserById(id: number): any {
    const stmt = this.db.prepare("SELECT * FROM users WHERE id = ?");
    return stmt.get(id);
  }

  getFirstUser(): any {
    const stmt = this.db.prepare(
      "SELECT * FROM users ORDER BY created_at ASC LIMIT 1"
    );
    return stmt.get();
  }

  updateUser(id: number, updates: UserUpdate): Database.RunResult | undefined {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.firstName !== undefined) {
      fields.push("first_name = ?");
      values.push(updates.firstName);
    }
    if (updates.lastName !== undefined) {
      fields.push("last_name = ?");
      values.push(updates.lastName);
    }
    if (updates.address !== undefined) {
      fields.push("address = ?");
      values.push(updates.address);
    }
    if (updates.email !== undefined) {
      fields.push("email = ?");
      values.push(updates.email);
    }

    if (fields.length === 0) return;

    values.push(id);
    const stmt = this.db.prepare(`
      UPDATE users 
      SET ${fields.join(", ")} 
      WHERE id = ?
    `);

    return stmt.run(...values);
  }

  // Transaction operations
  createTransaction(transaction: TransactionInput): {
    id: string;
    result: Database.RunResult;
  } {
    const stmt = this.db.prepare(`
      INSERT INTO transactions 
      (id, user_id, date, description, amount, type, category, check_number, is_reconciled, account_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Retry up to 3 times in case of UUID collision (extremely rare)
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const id = crypto.randomUUID();

        const result = stmt.run(
          id,
          transaction.userId,
          transaction.date,
          transaction.description,
          transaction.amount,
          transaction.type,
          transaction.category || null,
          transaction.checkNumber || null,
          transaction.isReconciled ? 1 : 0,
          transaction.accountId || null
        );

        return { id, result };
      } catch (error) {
        // Check if it's a primary key constraint violation
        if ((error as any).code === "SQLITE_CONSTRAINT_PRIMARYKEY") {
          lastError = error as Error;
          continue; // Try again with new UUID
        }
        // If it's a different error, throw immediately
        throw error;
      }
    }

    // If we exhausted all retries, throw the last error
    throw (
      lastError ||
      new Error("Failed to create transaction after multiple attempts")
    );
  }

  getTransactionsByUserId(userId: number): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM transactions 
      WHERE user_id = ? 
      ORDER BY date DESC
    `);
    return stmt.all(userId);
  }

  updateTransaction(
    id: string,
    updates: TransactionUpdate
  ): Database.RunResult | undefined {
    // Validate that ID is provided
    if (!id) {
      throw new Error("Transaction ID is required for update");
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.date !== undefined) {
      fields.push("date = ?");
      values.push(updates.date);
    }
    if (updates.description !== undefined) {
      fields.push("description = ?");
      values.push(updates.description);
    }
    if (updates.amount !== undefined) {
      fields.push("amount = ?");
      values.push(updates.amount);
    }
    if (updates.type !== undefined) {
      fields.push("type = ?");
      values.push(updates.type);
    }
    if (updates.category !== undefined) {
      fields.push("category = ?");
      values.push(updates.category);
    }
    if (updates.checkNumber !== undefined) {
      fields.push("check_number = ?");
      values.push(updates.checkNumber);
    }
    if (updates.isReconciled !== undefined) {
      fields.push("is_reconciled = ?");
      values.push(updates.isReconciled ? 1 : 0);
    }

    if (fields.length === 0) return;

    values.push(id);
    const stmt = this.db.prepare(`
      UPDATE transactions 
      SET ${fields.join(", ")} 
      WHERE id = ?
    `);

    return stmt.run(...values);
  }

  deleteTransaction(id: string): Database.RunResult {
    // Validate that ID is provided
    if (!id) {
      throw new Error("Transaction ID is required for delete");
    }

    const stmt = this.db.prepare("DELETE FROM transactions WHERE id = ?");
    return stmt.run(id);
  }

  // Reconciliation operations
  findUnreconciledTransactionsByAmount(
    userId: number,
    amount: number,
    dateFrom: string | null = null,
    dateTo: string | null = null
  ): any[] {
    let query = `
      SELECT * FROM transactions 
      WHERE user_id = ? 
      AND is_reconciled = 0 
      AND amount = ?
    `;

    const params: any[] = [userId, amount];

    if (dateFrom) {
      query += " AND date >= ?";
      params.push(dateFrom);
    }

    if (dateTo) {
      query += " AND date <= ?";
      params.push(dateTo);
    }

    query += " ORDER BY date DESC";

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  // Find all transactions by amount (including reconciled ones) for CSV import matching
  findTransactionsByAmount(
    userId: number,
    amount: number,
    dateFrom: string | null = null,
    dateTo: string | null = null
  ): any[] {
    let query = `
      SELECT * FROM transactions 
      WHERE user_id = ? 
      AND amount = ?
    `;

    const params: any[] = [userId, amount];

    if (dateFrom) {
      query += " AND date >= ?";
      params.push(dateFrom);
    }

    if (dateTo) {
      query += " AND date <= ?";
      params.push(dateTo);
    }

    query += " ORDER BY is_reconciled ASC, date DESC";

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  markTransactionReconciled(
    id: string,
    isReconciled: boolean = true
  ): Database.RunResult {
    const stmt = this.db.prepare(
      "UPDATE transactions SET is_reconciled = ? WHERE id = ?"
    );
    return stmt.run(isReconciled ? 1 : 0, id);
  }

  getUnreconciledTransactionsByUserId(userId: number): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM transactions 
      WHERE user_id = ? 
      AND is_reconciled = 0
      ORDER BY date DESC
    `);
    return stmt.all(userId);
  }

  // Category operations
  createCategory(
    userId: number,
    name: string,
    type: string,
    isDefault: boolean = false
  ): number {
    const stmt = this.db.prepare(`
      INSERT INTO categories (user_id, name, type, is_default)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(userId, name, type, isDefault ? 1 : 0);
    return result.lastInsertRowid as number;
  }

  getCategoriesByUserId(userId: number): any[] {
    const stmt = this.db.prepare(
      "SELECT * FROM categories WHERE user_id = ? ORDER BY type, name"
    );
    return stmt.all(userId);
  }

  deleteCategory(id: number): Database.RunResult {
    const stmt = this.db.prepare(
      "DELETE FROM categories WHERE id = ? AND is_default = 0"
    );
    return stmt.run(id);
  }

  initializeDefaultCategories(userId: number): void {
    const defaultCategories = {
      income: [
        "Salary",
        "Freelance Income",
        "Investment Income",
        "Rental Income",
        "Business Income",
        "Bonus",
        "Tax Refund",
        "Gift Received",
        "Other Income",
      ],
      expense: [
        "Groceries",
        "Rent/Mortgage",
        "Utilities",
        "Transportation",
        "Healthcare",
        "Insurance",
        "Entertainment",
        "Dining Out",
        "Shopping",
        "Education",
        "Travel",
        "Personal Care",
        "Home Maintenance",
        "Subscriptions",
        "Debt Payment",
        "Savings",
        "Taxes",
        "Charity/Donations",
        "Other Expense",
      ],
    };

    // Check if user already has categories
    const existing = this.getCategoriesByUserId(userId);
    if (existing.length > 0) {
      return; // User already has categories
    }

    // Insert default categories
    for (const [type, categories] of Object.entries(defaultCategories)) {
      for (const name of categories) {
        try {
          this.createCategory(userId, name, type, true);
        } catch (err) {
          // Ignore duplicates
          console.error(
            `Failed to create category ${name}:`,
            (err as Error).message
          );
        }
      }
    }
  }

  // Utility operations
  getAllData(userId: number): any {
    return {
      user: this.getUserById(userId),
      transactions: this.getTransactionsByUserId(userId),
    };
  }

  close(): void {
    this.db.close();
  }

  // Backup database
  backup(backupPath: string): Promise<any> {
    return this.db.backup(backupPath);
  }
}

export default EncryptedDatabase;

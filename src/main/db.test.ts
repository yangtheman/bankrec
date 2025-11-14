import fs from "fs";
import os from "os";
import path from "path";

// Import the class - we'll need to access it through module for mocking
// @ts-ignore - dynamic import for testing
const dbModule = require("./db");
const EncryptedDatabase = dbModule.default;

describe("EncryptedDatabase", () => {
  let testDbPath: string;
  let db: any;
  const testEncryptionKey = "test-encryption-key-for-testing";

  beforeEach(() => {
    // Create a unique test database for each test
    const testDir = path.join(os.tmpdir(), "bankrec-test");
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    testDbPath = path.join(testDir, `test-${Date.now()}.db`);
    db = new EncryptedDatabase(testDbPath, testEncryptionKey);
  });

  afterEach(() => {
    // Clean up
    if (db && db.db) {
      db.db.close();
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe("Database Initialization", () => {
    test("should create database file", () => {
      expect(fs.existsSync(testDbPath)).toBe(true);
    });

    test("should create users table", () => {
      const result = db.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
        )
        .get();
      expect(result).toBeTruthy();
      expect(result.name).toBe("users");
    });

    test("should create transactions table", () => {
      const result = db.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'"
        )
        .get();
      expect(result).toBeTruthy();
    });

    test("should create plaid_items table", () => {
      const result = db.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='plaid_items'"
        )
        .get();
      expect(result).toBeTruthy();
    });

    test("should create plaid_accounts table", () => {
      const result = db.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='plaid_accounts'"
        )
        .get();
      expect(result).toBeTruthy();
    });

    test("should enable foreign keys", () => {
      const result = db.db.pragma("foreign_keys", { simple: true });
      expect(result).toBe(1);
    });
  });

  describe("User Operations", () => {
    test("should create a new user", () => {
      const userId = db.createUser(
        "test@example.com",
        "John",
        "Doe",
        "123 Main St"
      );
      expect(userId).toBeGreaterThan(0);
    });

    test("should not create duplicate users with same email", () => {
      db.createUser("test@example.com", "John", "Doe");
      expect(() => {
        db.createUser("test@example.com", "Jane", "Smith");
      }).toThrow();
    });

    test("should get user by ID", () => {
      const userId = db.createUser(
        "test@example.com",
        "John",
        "Doe",
        "123 Main St"
      );
      const user = db.getUser(userId);

      expect(user).toBeTruthy();
      expect(user.email).toBe("test@example.com");
      expect(user.first_name).toBe("John");
      expect(user.last_name).toBe("Doe");
    });

    test("should get user by email", () => {
      db.createUser("test@example.com", "John", "Doe");
      const user = db.getUserByEmail("test@example.com");

      expect(user).toBeTruthy();
      expect(user.email).toBe("test@example.com");
    });

    test("should return null for non-existent user", () => {
      const user = db.getUser(99999);
      expect(user).toBeNull();
    });

    test("should update user information", () => {
      const userId = db.createUser("test@example.com", "John", "Doe");

      db.updateUser(userId, {
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
      });

      const user = db.getUser(userId);
      expect(user.first_name).toBe("Jane");
      expect(user.last_name).toBe("Smith");
      expect(user.email).toBe("jane@example.com");
    });

    test("should handle partial user updates", () => {
      const userId = db.createUser("test@example.com", "John", "Doe");

      db.updateUser(userId, { firstName: "Jane" });

      const user = db.getUser(userId);
      expect(user.first_name).toBe("Jane");
      expect(user.last_name).toBe("Doe"); // Unchanged
    });
  });

  describe("Transaction Operations", () => {
    let userId: number;

    beforeEach(() => {
      userId = db.createUser("test@example.com", "John", "Doe");
    });

    test("should create a new transaction", () => {
      const transaction = {
        id: "txn_123",
        userId,
        date: "2024-01-15",
        description: "Test transaction",
        amount: 100.5,
        type: "debit",
      };

      db.createTransaction(transaction);

      const result = db.db
        .prepare("SELECT * FROM transactions WHERE id = ?")
        .get("txn_123");
      expect(result).toBeTruthy();
      expect(result.description).toBe("Test transaction");
      expect(result.amount).toBe(100.5);
    });

    test("should get transaction by ID", () => {
      const transaction = {
        id: "txn_123",
        userId,
        date: "2024-01-15",
        description: "Test transaction",
        amount: 100.5,
        type: "debit",
      };

      db.createTransaction(transaction);
      const result = db.getTransaction("txn_123");

      expect(result).toBeTruthy();
      expect(result.id).toBe("txn_123");
      expect(result.amount).toBe(100.5);
    });

    test("should get all transactions for a user", () => {
      db.createTransaction({
        id: "txn_1",
        userId,
        date: "2024-01-15",
        description: "Transaction 1",
        amount: 100,
        type: "debit",
      });

      db.createTransaction({
        id: "txn_2",
        userId,
        date: "2024-01-16",
        description: "Transaction 2",
        amount: 200,
        type: "credit",
      });

      const transactions = db.getTransactions(userId);
      expect(transactions).toHaveLength(2);
    });

    test("should update transaction", () => {
      db.createTransaction({
        id: "txn_123",
        userId,
        date: "2024-01-15",
        description: "Original",
        amount: 100,
        type: "debit",
      });

      db.updateTransaction("txn_123", {
        description: "Updated",
        amount: 150,
        isReconciled: true,
      });

      const result = db.getTransaction("txn_123");
      expect(result.description).toBe("Updated");
      expect(result.amount).toBe(150);
      expect(result.is_reconciled).toBe(1);
    });

    test("should delete transaction", () => {
      db.createTransaction({
        id: "txn_123",
        userId,
        date: "2024-01-15",
        description: "Test",
        amount: 100,
        type: "debit",
      });

      db.deleteTransaction("txn_123");

      const result = db.getTransaction("txn_123");
      expect(result).toBeNull();
    });

    test("should handle transactions with optional fields", () => {
      db.createTransaction({
        id: "txn_123",
        userId,
        date: "2024-01-15",
        description: "Test",
        amount: 100,
        type: "debit",
        category: "Groceries",
        checkNumber: "1234",
        accountId: "acc_456",
      });

      const result = db.getTransaction("txn_123");
      expect(result.category).toBe("Groceries");
      expect(result.check_number).toBe("1234");
      expect(result.account_id).toBe("acc_456");
    });

    test("should filter transactions by date range", () => {
      db.createTransaction({
        id: "txn_1",
        userId,
        date: "2024-01-15",
        description: "Transaction 1",
        amount: 100,
        type: "debit",
      });

      db.createTransaction({
        id: "txn_2",
        userId,
        date: "2024-02-15",
        description: "Transaction 2",
        amount: 200,
        type: "debit",
      });

      const transactions = db.getTransactionsByDateRange(
        userId,
        "2024-02-01",
        "2024-02-28"
      );
      expect(transactions).toHaveLength(1);
      expect(transactions[0].id).toBe("txn_2");
    });

    test("should filter unreconciled transactions", () => {
      db.createTransaction({
        id: "txn_1",
        userId,
        date: "2024-01-15",
        description: "Reconciled",
        amount: 100,
        type: "debit",
        isReconciled: true,
      });

      db.createTransaction({
        id: "txn_2",
        userId,
        date: "2024-01-16",
        description: "Not reconciled",
        amount: 200,
        type: "debit",
        isReconciled: false,
      });

      const transactions = db.getUnreconciledTransactions(userId);
      expect(transactions).toHaveLength(1);
      expect(transactions[0].id).toBe("txn_2");
    });
  });

  describe("Encryption and Decryption", () => {
    test("should encrypt text", () => {
      const plaintext = "sensitive data";
      const encrypted = db.encrypt(plaintext);

      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted).toContain(":"); // iv:authTag:encrypted format
    });

    test("should decrypt encrypted text", () => {
      const plaintext = "sensitive data";
      const encrypted = db.encrypt(plaintext);
      const decrypted = db.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test("should handle null encryption", () => {
      const encrypted = db.encrypt(null);
      expect(encrypted).toBeNull();
    });

    test("should handle null decryption", () => {
      const decrypted = db.decrypt(null);
      expect(decrypted).toBeNull();
    });

    test("should generate different encrypted values for same input", () => {
      const plaintext = "sensitive data";
      const encrypted1 = db.encrypt(plaintext);
      const encrypted2 = db.encrypt(plaintext);

      // Different due to random IV
      expect(encrypted1).not.toBe(encrypted2);

      // But both decrypt to same value
      expect(db.decrypt(encrypted1)).toBe(plaintext);
      expect(db.decrypt(encrypted2)).toBe(plaintext);
    });

    test("should handle decryption of invalid format gracefully", () => {
      const decrypted = db.decrypt("invalid-encrypted-text");
      expect(decrypted).toBe("invalid-encrypted-text"); // Returns as-is for non-encrypted
    });
  });

  describe("Search and Filtering", () => {
    let userId: number;

    beforeEach(() => {
      userId = db.createUser("test@example.com", "John", "Doe");

      db.createTransaction({
        id: "txn_1",
        userId,
        date: "2024-01-15",
        description: "Grocery Store",
        amount: 50,
        type: "debit",
        category: "Groceries",
      });

      db.createTransaction({
        id: "txn_2",
        userId,
        date: "2024-01-16",
        description: "Gas Station",
        amount: 40,
        type: "debit",
        category: "Transportation",
      });

      db.createTransaction({
        id: "txn_3",
        userId,
        date: "2024-01-17",
        description: "Salary Deposit",
        amount: 2000,
        type: "credit",
        category: "Income",
      });
    });

    test("should search transactions by description", () => {
      const results = db.searchTransactions(userId, "Grocery");
      expect(results).toHaveLength(1);
      expect(results[0].description).toContain("Grocery");
    });

    test("should filter transactions by type", () => {
      const debits = db.getTransactionsByType(userId, "debit");
      expect(debits).toHaveLength(2);

      const credits = db.getTransactionsByType(userId, "credit");
      expect(credits).toHaveLength(1);
    });

    test("should filter transactions by category", () => {
      const groceries = db.getTransactionsByCategory(userId, "Groceries");
      expect(groceries).toHaveLength(1);
      expect(groceries[0].category).toBe("Groceries");
    });
  });

  describe("Edge Cases and Error Handling", () => {
    test("should handle database with invalid encryption key", () => {
      const dbPath = path.join(os.tmpdir(), `test-invalid-${Date.now()}.db`);
      const db1 = new EncryptedDatabase(dbPath, "key1");

      const encrypted = db1.encrypt("test data");
      db1.db.close();

      // Open with different key
      const db2 = new EncryptedDatabase(dbPath, "key2");
      const decrypted = db2.decrypt(encrypted);

      // Should fail to decrypt properly
      expect(decrypted).toBeNull();

      db2.db.close();
      fs.unlinkSync(dbPath);
    });

    test("should handle very large transaction amounts", () => {
      const userId = db.createUser("test@example.com", "John", "Doe");

      db.createTransaction({
        id: "txn_large",
        userId,
        date: "2024-01-15",
        description: "Large transaction",
        amount: 999999999.99,
        type: "credit",
      });

      const result = db.getTransaction("txn_large");
      expect(result.amount).toBe(999999999.99);
    });

    test("should handle special characters in descriptions", () => {
      const userId = db.createUser("test@example.com", "John", "Doe");

      const specialDesc = 'Test\'s & "Special" <Characters> 测试';
      db.createTransaction({
        id: "txn_special",
        userId,
        date: "2024-01-15",
        description: specialDesc,
        amount: 100,
        type: "debit",
      });

      const result = db.getTransaction("txn_special");
      expect(result.description).toBe(specialDesc);
    });
  });
});

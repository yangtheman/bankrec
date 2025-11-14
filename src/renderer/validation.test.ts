import {
  isValidEmail,
  RateLimiter,
  sanitizeString,
  validateCategory,
  validateFilePath,
  validateTransactionData,
  validateUserData,
} from "./validation";

describe("Validation Module", () => {
  describe("isValidEmail", () => {
    test("should validate correct email addresses", () => {
      expect(isValidEmail("test@example.com")).toBe(true);
      expect(isValidEmail("user.name@domain.co.uk")).toBe(true);
      expect(isValidEmail("user+tag@example.com")).toBe(true);
    });

    test("should reject invalid email addresses", () => {
      expect(isValidEmail("invalid")).toBe(false);
      expect(isValidEmail("invalid@")).toBe(false);
      expect(isValidEmail("@domain.com")).toBe(false);
      expect(isValidEmail("user@")).toBe(false);
      expect(isValidEmail("")).toBe(false);
    });

    test("should reject non-string inputs", () => {
      expect(isValidEmail(123 as any)).toBe(false);
      expect(isValidEmail(null as any)).toBe(false);
      expect(isValidEmail(undefined as any)).toBe(false);
    });

    test("should reject emails longer than 254 characters", () => {
      const longEmail = "a".repeat(250) + "@test.com";
      expect(isValidEmail(longEmail)).toBe(false);
    });
  });

  describe("sanitizeString", () => {
    test("should remove null bytes and control characters", () => {
      expect(sanitizeString("hello\0world")).toBe("helloworld");
      expect(sanitizeString("test\x00string")).toBe("teststring");
      expect(sanitizeString("clean\x08text")).toBe("cleantext");
    });

    test("should trim whitespace", () => {
      expect(sanitizeString("  hello  ")).toBe("hello");
      expect(sanitizeString("\t\ntest\n\t")).toBe("test");
    });

    test("should limit string length", () => {
      const longString = "a".repeat(2000);
      expect(sanitizeString(longString, 100).length).toBe(100);
      expect(sanitizeString(longString).length).toBe(1000); // default max
    });

    test("should handle non-string inputs", () => {
      expect(sanitizeString(123 as any)).toBe("");
      expect(sanitizeString(null as any)).toBe("");
      expect(sanitizeString(undefined as any)).toBe("");
    });

    test("should preserve normal text", () => {
      expect(sanitizeString("Hello, World!")).toBe("Hello, World!");
      expect(sanitizeString("Test 123")).toBe("Test 123");
    });
  });

  describe("validateUserData", () => {
    test("should validate correct user data", () => {
      const user = {
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
      };
      const result = validateUserData(user);
      expect(result.email).toBe("test@example.com");
      expect(result.firstName).toBe("John");
      expect(result.lastName).toBe("Doe");
    });

    test("should accept user with only email", () => {
      const user = { email: "test@example.com" };
      const result = validateUserData(user);
      expect(result.email).toBe("test@example.com");
      expect(result.firstName).toBeNull();
      expect(result.lastName).toBeNull();
    });

    test("should throw error for invalid email", () => {
      const user = { email: "invalid-email" };
      expect(() => validateUserData(user)).toThrow("Invalid email address");
    });

    test("should throw error for missing email", () => {
      const user = { firstName: "John" };
      expect(() => validateUserData(user as any)).toThrow(
        "Invalid email address"
      );
    });

    test("should throw error for names that are too long", () => {
      const user = {
        email: "test@example.com",
        firstName: "a".repeat(101),
      };
      expect(() => validateUserData(user)).toThrow("First name too long");
    });

    test("should throw error for invalid input", () => {
      expect(() => validateUserData(null as any)).toThrow("Invalid user data");
      expect(() => validateUserData("string" as any)).toThrow(
        "Invalid user data"
      );
    });

    test("should sanitize user input", () => {
      const user = {
        email: "test@example.com",
        firstName: "  John\0  ",
        lastName: "  Doe\x00  ",
      };
      const result = validateUserData(user);
      expect(result.firstName).toBe("John");
      expect(result.lastName).toBe("Doe");
    });
  });

  describe("validateTransactionData", () => {
    const validTransaction = {
      id: "txn_123",
      date: "2024-01-15",
      description: "Test transaction",
      amount: 100.5,
      type: "debit",
    };

    test("should validate correct transaction data", () => {
      const result = validateTransactionData(validTransaction);
      expect(result.id).toBe("txn_123");
      expect(result.date).toBe("2024-01-15");
      expect(result.description).toBe("Test transaction");
      expect(result.amount).toBe(100.5);
      expect(result.type).toBe("debit");
    });

    test("should handle optional fields", () => {
      const txn = {
        ...validTransaction,
        category: "Groceries",
        isReconciled: true,
        accountId: "acc_456",
      };
      const result = validateTransactionData(txn);
      expect(result.category).toBe("Groceries");
      expect(result.isReconciled).toBe(true);
      expect(result.accountId).toBe("acc_456");
    });

    test("should throw error for missing required fields", () => {
      expect(() => validateTransactionData({} as any)).toThrow(
        "Transaction date is required"
      );

      expect(() => validateTransactionData({ id: "txn_123" } as any)).toThrow(
        "Transaction date is required"
      );

      expect(() =>
        validateTransactionData({ id: "txn_123", date: "2024-01-15" } as any)
      ).toThrow("Transaction description is required");
    });

    test("should throw error for invalid amount", () => {
      const txn = { ...validTransaction, amount: "invalid" as any };
      expect(() => validateTransactionData(txn)).toThrow(
        "amount must be a valid number"
      );
    });

    test("should throw error for invalid type", () => {
      const txn = { ...validTransaction, type: "invalid" };
      expect(() => validateTransactionData(txn)).toThrow(
        'type must be "debit" or "credit"'
      );
    });

    test("should throw error for excessive amount", () => {
      const txn = { ...validTransaction, amount: 1000000000 };
      expect(() => validateTransactionData(txn)).toThrow(
        "exceeds maximum allowed value"
      );
    });

    test("should sanitize transaction data", () => {
      const txn = {
        ...validTransaction,
        description: "  Test\0transaction  ",
        category: "  Groceries\x00  ",
      };
      const result = validateTransactionData(txn);
      expect(result.description).toBe("Testtransaction");
      expect(result.category).toBe("Groceries");
    });

    test("should convert isReconciled to boolean", () => {
      const txn1 = { ...validTransaction, isReconciled: 1 as any };
      expect(validateTransactionData(txn1).isReconciled).toBe(true);

      const txn2 = { ...validTransaction, isReconciled: 0 as any };
      expect(validateTransactionData(txn2).isReconciled).toBe(false);
    });
  });

  describe("validateCategory", () => {
    test("should validate correct category data", () => {
      const result = validateCategory("Groceries", "expense");
      expect(result.name).toBe("Groceries");
      expect(result.type).toBe("expense");
    });

    test("should accept income type", () => {
      const result = validateCategory("Salary", "income");
      expect(result.name).toBe("Salary");
      expect(result.type).toBe("income");
    });

    test("should throw error for missing name", () => {
      expect(() => validateCategory("", "expense")).toThrow(
        "Category name is required"
      );
      expect(() => validateCategory(null as any, "expense")).toThrow(
        "Category name is required"
      );
    });

    test("should throw error for invalid type", () => {
      expect(() => validateCategory("Test", "invalid")).toThrow(
        'type must be "income" or "expense"'
      );
    });

    test("should throw error for name that is too long", () => {
      const longName = "a".repeat(101);
      expect(() => validateCategory(longName, "expense")).toThrow(
        "Category name too long"
      );
    });

    test("should sanitize category name", () => {
      const result = validateCategory("  Groceries\0  ", "expense");
      expect(result.name).toBe("Groceries");
    });
  });

  describe("validateFilePath", () => {
    test("should validate normal file paths", () => {
      expect(validateFilePath("/path/to/file.txt")).toBe("/path/to/file.txt");
      expect(validateFilePath("relative/path.txt")).toBe("relative/path.txt");
    });

    test("should throw error for directory traversal attempts", () => {
      expect(() => validateFilePath("../../../etc/passwd")).toThrow(
        "directory traversal detected"
      );
      expect(() => validateFilePath("path/../../../file")).toThrow(
        "directory traversal detected"
      );
    });

    test("should throw error for null bytes", () => {
      expect(() => validateFilePath("path/to\0/file")).toThrow(
        "directory traversal detected"
      );
    });

    test("should throw error for invalid input", () => {
      expect(() => validateFilePath("")).toThrow("Invalid file path");
      expect(() => validateFilePath(null as any)).toThrow("Invalid file path");
    });

    test("should sanitize file paths", () => {
      const result = validateFilePath("  /path/to/file.txt  ");
      expect(result).toBe("/path/to/file.txt");
    });
  });

  describe("RateLimiter", () => {
    test("should allow requests within limit", () => {
      const limiter = new RateLimiter(3, 1000); // 3 requests per second
      expect(limiter.check("user1")).toBe(true);
      expect(limiter.check("user1")).toBe(true);
      expect(limiter.check("user1")).toBe(true);
    });

    test("should block requests exceeding limit", () => {
      const limiter = new RateLimiter(2, 1000);
      expect(limiter.check("user1")).toBe(true);
      expect(limiter.check("user1")).toBe(true);
      expect(limiter.check("user1")).toBe(false); // Should be blocked
    });

    test("should track different users separately", () => {
      const limiter = new RateLimiter(2, 1000);
      expect(limiter.check("user1")).toBe(true);
      expect(limiter.check("user1")).toBe(true);
      expect(limiter.check("user2")).toBe(true); // Different user
      expect(limiter.check("user2")).toBe(true);
    });

    test("should allow requests after window expires", async () => {
      const limiter = new RateLimiter(2, 100); // 100ms window
      expect(limiter.check("user1")).toBe(true);
      expect(limiter.check("user1")).toBe(true);
      expect(limiter.check("user1")).toBe(false);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(limiter.check("user1")).toBe(true); // Should be allowed again
    });

    test("should reset user attempts", () => {
      const limiter = new RateLimiter(2, 1000);
      expect(limiter.check("user1")).toBe(true);
      expect(limiter.check("user1")).toBe(true);
      expect(limiter.check("user1")).toBe(false);

      limiter.reset("user1");

      expect(limiter.check("user1")).toBe(true); // Should be allowed after reset
    });
  });
});

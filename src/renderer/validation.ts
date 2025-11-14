/**
 * Input validation utilities for security
 */

interface UserData {
  email?: string;
  firstName?: string;
  lastName?: string;
}

interface ValidatedUser {
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface TransactionData {
  id?: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  category?: string | null;
  checkNumber?: string | null;
  isReconciled?: boolean;
  accountId?: string | null;
}

interface ValidatedTransaction {
  id?: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  category: string | null;
  checkNumber: string | null;
  isReconciled: boolean;
  accountId: string | null;
}

interface ValidatedCategory {
  name: string;
  type: string;
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  if (typeof email !== "string") return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Sanitize string input to prevent injection attacks
 */
function sanitizeString(input: string, maxLength: number = 1000): string {
  if (typeof input !== "string") return "";
  // Remove any null bytes and control characters
  let sanitized = input
    .replace(/\0/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  // Trim and limit length
  return sanitized.trim().substring(0, maxLength);
}

/**
 * Validate and sanitize user data
 */
function validateUserData(user: UserData): ValidatedUser {
  if (!user || typeof user !== "object") {
    throw new Error("Invalid user data");
  }

  const errors: string[] = [];

  // Email validation
  if (!user.email || !isValidEmail(user.email)) {
    errors.push("Invalid email address");
  }

  // Name validation
  if (user.firstName && typeof user.firstName === "string") {
    if (user.firstName.length > 100) {
      errors.push("First name too long (max 100 characters)");
    }
  }

  if (user.lastName && typeof user.lastName === "string") {
    if (user.lastName.length > 100) {
      errors.push("Last name too long (max 100 characters)");
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join(", "));
  }

  return {
    email: sanitizeString(user.email!, 254),
    firstName: user.firstName ? sanitizeString(user.firstName, 100) : null,
    lastName: user.lastName ? sanitizeString(user.lastName, 100) : null,
  };
}

/**
 * Validate and sanitize transaction data
 */
function validateTransactionData(
  transaction: TransactionData
): ValidatedTransaction {
  if (!transaction || typeof transaction !== "object") {
    throw new Error("Invalid transaction data");
  }

  const errors: string[] = [];

  // ID is optional - backend will generate if not provided
  if (transaction.id && typeof transaction.id !== "string") {
    errors.push("Transaction ID must be a string if provided");
  }

  if (!transaction.date || typeof transaction.date !== "string") {
    errors.push("Transaction date is required");
  }

  if (!transaction.description || typeof transaction.description !== "string") {
    errors.push("Transaction description is required");
  }

  if (typeof transaction.amount !== "number" || isNaN(transaction.amount)) {
    errors.push("Transaction amount must be a valid number");
  }

  if (!transaction.type || !["debit", "credit"].includes(transaction.type)) {
    errors.push('Transaction type must be "debit" or "credit"');
  }

  // Validate amount range (prevent overflow)
  if (Math.abs(transaction.amount) > 999999999.99) {
    errors.push("Transaction amount exceeds maximum allowed value");
  }

  if (errors.length > 0) {
    throw new Error(errors.join(", "));
  }

  return {
    id: transaction.id ? sanitizeString(transaction.id, 100) : undefined,
    date: sanitizeString(transaction.date, 20),
    description: sanitizeString(transaction.description, 500),
    amount: transaction.amount,
    type: transaction.type,
    category: transaction.category
      ? sanitizeString(transaction.category, 100)
      : null,
    checkNumber: transaction.checkNumber
      ? sanitizeString(transaction.checkNumber, 50)
      : null,
    isReconciled: Boolean(transaction.isReconciled),
    accountId: transaction.accountId
      ? sanitizeString(transaction.accountId, 100)
      : null,
  };
}

/**
 * Validate category data
 */
function validateCategory(name: string, type: string): ValidatedCategory {
  if (!name || typeof name !== "string") {
    throw new Error("Category name is required");
  }

  if (!type || !["income", "expense"].includes(type)) {
    throw new Error('Category type must be "income" or "expense"');
  }

  if (name.length > 100) {
    throw new Error("Category name too long (max 100 characters)");
  }

  return {
    name: sanitizeString(name, 100),
    type: type,
  };
}

/**
 * Validate file path to prevent directory traversal
 */
function validateFilePath(filePath: string): string {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("Invalid file path");
  }

  // Check for directory traversal attempts
  if (filePath.includes("..") || filePath.includes("\0")) {
    throw new Error("Invalid file path: directory traversal detected");
  }

  return sanitizeString(filePath, 1000);
}

/**
 * Rate limiter utility
 */
class RateLimiter {
  private maxAttempts: number;
  private windowMs: number;
  private attempts: Map<string, number[]>;

  constructor(maxAttempts: number, windowMs: number) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.attempts = new Map();
  }

  check(key: string): boolean {
    const now = Date.now();
    const userAttempts = this.attempts.get(key) || [];

    // Filter out old attempts outside the window
    const recentAttempts = userAttempts.filter(
      (timestamp) => now - timestamp < this.windowMs
    );

    if (recentAttempts.length >= this.maxAttempts) {
      return false; // Rate limit exceeded
    }

    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);

    return true; // Within rate limit
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}

export {
  RateLimiter,
  isValidEmail,
  sanitizeString,
  validateCategory,
  validateFilePath,
  validateTransactionData,
  validateUserData,
};

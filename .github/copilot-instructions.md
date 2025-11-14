# BankRec Development Guide

## Architecture Overview

**Electron App Structure**: Classic 3-process architecture

- **Main Process** (`src/main/main.ts`): Handles database operations, IPC handlers, encryption key management
- **Preload Script** (`src/preload/preload.ts`): Context bridge for secure IPC communication via `electronAPI`
- **Renderer Process** (`src/renderer/`, `src/views/`): Frontend UI with vanilla JS and Tailwind CSS + DaisyUI

**Security-First Design**: All sensitive data uses AES-256-GCM encryption

- Encryption keys stored in OS keychain via `keytar` (falls back to encrypted file if unavailable)
- `EncryptionKeyManager` (`src/main/encryption-manager.ts`) handles key lifecycle
- `EncryptedDatabase` (`src/main/db.ts`) wraps Better-SQLite3 with transparent encrypt/decrypt on all sensitive fields
- User must save encryption key during onboarding - required for data export/import

## Development Workflow

**Prerequisites**: Native build tools required for `better-sqlite3` compilation

- macOS: `xcode-select --install`
- Windows: Visual Studio Build Tools

**Start Development**:

```bash
yarn install          # Includes native module rebuild
yarn start            # Compile TS + Build CSS + Launch Electron
yarn dev:watch        # Watch mode with hot-reload (TypeScript + Tailwind)
```

**Testing**:

```bash
yarn test             # Run Jest tests (excludes db.test.ts - needs Electron environment)
yarn test:coverage    # Generate coverage report in coverage/
```

**Database Reset** (useful during development):

```bash
yarn reset-db         # Deletes ~/Library/Application Support/bankrec/data/bankrec.db
```

**Build for Production**:

```bash
yarn build:mac        # Creates DMG and ZIP for macOS
yarn build:win        # Creates NSIS installer and portable EXE
```

## Key Patterns & Conventions

### IPC Communication Pattern

All main-renderer communication follows strict validation:

1. Renderer calls `electronAPI.*` method (exposed via preload)
2. Preload forwards to main via `ipcRenderer.invoke()`
3. Main validates with `validation.ts` functions (`validateUserData`, `validateTransactionData`, `validateFilePath`)
4. Main returns `{ success: boolean, error?: string, ...data }`

**Example**: See `ipcMain.handle('save-data', ...)` in `main.ts` and `saveData` in `preload.ts`

### Database Access Pattern

- **Never** access `db.db` (raw SQLite) directly - use `EncryptedDatabase` methods
- All sensitive fields auto-encrypt/decrypt: `description`, `category`, user names
- Database uses WAL mode for better concurrency
- Schema migrations happen in `initializeTables()` with try-catch for existing columns

**Transaction Structure**:

```typescript
{
  id: string,           // UUID
  userId: number,
  date: string,         // ISO format
  description: string,  // Encrypted
  amount: number,
  type: 'debit' | 'credit',
  category?: string,    // Encrypted, nullable
  checkNumber?: string, // Optional
  isReconciled: boolean,
  accountId?: string    // Nullable, for future multi-account support
}
```

### Validation & Security

- All inputs validated via `src/renderer/validation.ts` before database operations
- Rate limiting implemented: `RateLimiter` class protects exports (5 per 5 min)
- Path traversal protection: `validateFilePath()` checks for `..` and absolute paths
- String sanitization: `sanitizeString()` removes null bytes and control characters

### TypeScript Configuration

- Strict mode enabled: `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`
- Compiled output: `dist/` directory (mirrors `src/` structure)
- Source maps enabled for debugging
- Tests: `*.test.ts` excluded from compilation

### Styling with Tailwind + DaisyUI

- Config: `config/tailwind.config.js`
- Input: `src/styles/input.css` → Output: `src/styles/styles.css`
- Dark mode: Uses class strategy (`darkMode: 'class'`)
- Build command: `yarn build:css` (or watch: `yarn build:css:watch`)
- Content paths include: `src/views/**/*.html`, `src/renderer/**/*.js`

## Common Tasks

**Adding New IPC Handler**:

1. Add handler in `src/main/main.ts`: `ipcMain.handle('my-action', async (_event, ...args) => { ... })`
2. Expose in `src/preload/preload.ts`: `myAction: (...args) => ipcRenderer.invoke('my-action', ...args)`
3. Add validation in handler using `validation.ts` functions
4. Return `{ success: boolean, error?: string }` structure

**Adding Database Method**:

1. Add method to `EncryptedDatabase` class in `src/main/db.ts`
2. Use `encrypt()` for sensitive data before storing
3. Use `decrypt()` when retrieving sensitive data
4. Add prepared statement with parameter binding (never string concatenation)
5. Add test in `src/main/db.test.ts`

**Adding Validation**:

1. Add validation function to `src/renderer/validation.ts`
2. Export function for use in main process
3. Add test in `src/renderer/validation.test.ts`
4. Use in IPC handlers before database operations

## Project-Specific Notes

- **No Build Server**: This is a desktop app, not a web app - no `localhost` server needed
- **Database Location**: Production DB at `~/Library/Application Support/bankrec/data/bankrec.db` (macOS), adjust for Windows/Linux
- **Encryption Key Storage**: Keytar stores in system keychain (Keychain Access on macOS, Credential Manager on Windows)
- **Test Exclusion**: `db.test.ts` skipped in Jest config due to Electron environment dependency
- **Asset Generation**: Icons generated via `assets/generate-icons.sh` script

## Critical Files Reference

- **Entry Point**: `src/main/main.ts` (752 lines) - all IPC handlers, app lifecycle
- **Database Core**: `src/main/db.ts` (519 lines) - encryption + CRUD operations
- **Security Layer**: `src/renderer/validation.ts` (248 lines) - input validation + sanitization
- **Key Management**: `src/main/encryption-manager.ts` (274 lines) - keychain integration
- **Frontend Bridge**: `src/preload/preload.ts` - secure context bridge definition

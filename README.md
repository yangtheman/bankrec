# BankRec - Bank Reconciliation Electron App

A cross-platform desktop application for managing and reconciling bank transactions, built with Electron.

<img width="1728" height="1081" alt="Screenshot 2025-11-11 at 8 34 09 PM" src="https://github.com/user-attachments/assets/51a8ab35-313b-4ebf-a099-1edef03fc3b2" />

<img width="1728" height="1080" alt="Screenshot 2025-11-11 at 8 33 46 PM" src="https://github.com/user-attachments/assets/a27222e1-46f4-42d5-ac0f-ccee780d5367" />

---

## ⚠️ DISCLAIMER

**USE AT YOUR OWN RISK**

This software is provided "as is" without warranty of any kind, express or implied. The authors and contributors make no guarantees about the software's functionality, security, or fitness for any particular purpose. 

- **No Support**: There is no official support or guarantee of maintenance
- **No Liability**: The authors are not liable for any damages, data loss, or financial losses
- **Financial Data**: This application handles sensitive financial information - review the code and use appropriate security measures
- **No Professional Advice**: This tool is not a substitute for professional financial advice
- **Backup Your Data**: Always maintain independent backups of your financial records

By using this software, you acknowledge and accept these terms.

---

## Features

✅ **User Onboarding**
- Collect user information (name, email)
- Clean, intuitive two-step setup flow
- Secure encryption key generation with visual confirmation
- Encryption key stored in OS keychain (Keytar)

✅ **Manual Transaction Entry**
- Add transactions with date, check number, payee, and amount
- Support for both debits (payments) and credits (deposits)
- Customizable transaction categories
- Edit and delete existing transactions
- Search and filter transactions by date, payee, or category
- Pagination for large transaction lists

✅ **Running Balance Calculation**
- Automatic balance updates
- Visual balance display in header
- Transaction history with running totals
- Real-time balance recalculation

✅ **Reconciliation Workflow**
- Track reconciled vs unreconciled transactions
- Guided reconciliation modal
- Visual status badges (Reconciled/Unreconciled)
- Bulk reconciliation operations

✅ **Encrypted Data Storage**
- AES-256-GCM encryption for all sensitive data
- Better-SQLite3 database with WAL mode
- Export/Import functionality with password protection
- Secure local storage with OS keychain integration
- Encrypted backup files (.enc format)

✅ **Cross-Platform Support**
- Build for macOS (DMG, ZIP)
- Build for Windows (NSIS installer, Portable)
- TypeScript for type safety
- Modern UI with Tailwind CSS and DaisyUI

---

## Quick Start

### Quick Start

1. **Install and Run:**
   ```bash
   yarn install
   yarn start
   ```

2. **Complete Onboarding:**
   - Enter your name and email
   - Click "Continue"
   - **IMPORTANT:** Save your encryption key! You'll need it to export/import your database
   - Check the box confirming you've saved the key
   - Click "Continue to Application"

3. **Try Features:**
   - Add manual transactions with categories
   - Mark transactions as reconciled
   - Search and filter transactions
   - Export/import your data
   - Test the reconciliation workflow

---

## Installation

### Prerequisites
- Node.js (v16 or higher)
- Yarn package manager
- Python (for native module compilation - better-sqlite3)
- Build tools:
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Windows**: Windows Build Tools or Visual Studio

### Setup

1. Clone the repository (if applicable):
```bash
git clone <repository-url>
cd bankrec
```

2. Install dependencies:
```bash
yarn install
```

3. Run the app in development mode:
```bash
yarn start
```

This will:
- Compile TypeScript files
- Build Tailwind CSS
- Launch the Electron app

---

## Building for Distribution

### Build for macOS:
```bash
yarn build:mac
```
Output: `dist/BankRec-1.0.0.dmg` and `dist/BankRec-1.0.0-mac.zip`

### Build for Windows:
```bash
yarn build:win
```
Output: `dist/BankRec Setup 1.0.0.exe` and `dist/BankRec 1.0.0.exe` (portable)

### Build for both platforms:
```bash
yarn build
```

---

## Usage Guide

### Adding Transactions

1. Fill in the transaction form:
   - **Date**: Transaction date
   - **Check Number**: Optional, but must be unique
   - **Payee**: Person or business
   - **Type**: Payment (Debit) or Deposit (Credit)
   - **Amount**: Transaction amount
   - **Reconciled**: Check if already reconciled

2. Click "Add Transaction"

### Reconciliation

1. When unreconciled transactions exist, you'll see a notification
2. Click "Start Reconciliation"
3. Check the transactions you've verified against your bank statement
4. Click "Save"

### Data Management

**Export Data:**
- Click "Export" in the header
- Choose a location to save your encrypted backup file
- File is encrypted with your encryption key

**Import Data:**
- Click "Import" in the header
- Select a previously exported `.enc` file
- Confirm to replace current data

---

## Security Notes

⚠️ **Important Security Considerations:**

1. **Encryption Key**:
   - Unique encryption key generated per user during onboarding
   - Stored securely in OS keychain using Keytar (when available)
   - Falls back to encrypted file storage if keychain not available
   - Save your key backup during onboarding for export/import operations
   - Uses AES-256-GCM encryption for all sensitive data

2. **Data Storage**: 
   - Database: Better-SQLite3 (embedded SQL database)
   - Location (encrypted data):
     - macOS: `~/Library/Application Support/BankRec/data/bankrec.db`
     - Windows: `%APPDATA%/BankRec/data/bankrec.db`
   - Encryption key storage:
     - macOS: Keychain (via Keytar)
     - Windows: Credential Manager (via Keytar)
     - Fallback: `~/Library/Application Support/BankRec/secure/.keystore` (macOS) or `%APPDATA%/BankRec/secure/.keystore` (Windows)

3. **Best Practices**:
   - Review the code before handling sensitive financial data
   - Keep your OS and dependencies updated
   - Use strong system passwords
   - Regular backups of encrypted data
   - Database uses WAL (Write-Ahead Logging) mode for better concurrency

---

## Technologies Used

- **Electron** - Cross-platform desktop framework
- **Electron Builder** - Application packaging
- **Better-SQLite3** - Fast, embedded SQL database
- **Node.js Crypto** - Data encryption (AES-256-GCM)
- **Keytar** - Secure OS keychain integration (optional)
- **TypeScript** - Type-safe development
- **Jest** - Testing framework
- **Tailwind CSS** - Modern styling framework
- **DaisyUI** - Component library for Tailwind

---

## Development

### Project Structure
```
src/
├── main/                    # Electron main process
│   ├── main.ts              # Main process, IPC handlers
│   ├── db.ts                # Database operations with Better-SQLite3
│   ├── encryption-manager.ts # Encryption key management
│   └── *.test.ts            # Unit tests
├── preload/                 # Preload scripts
│   └── preload.ts           # IPC bridge for renderer process
├── renderer/                # UI and application logic
│   ├── app.js               # Main application logic
│   └── validation.ts        # Input validation and rate limiting
├── styles/                  # CSS styles
│   ├── input.css            # Tailwind CSS source
│   └── styles.css           # Compiled CSS (generated)
└── views/                   # HTML templates
    └── index.html           # Main application UI

config/
├── tailwind.config.js       # Tailwind CSS configuration
└── postcss.config.js        # PostCSS configuration

Database Schema (SQLite):
- users: User information
- transactions: Transaction records
- categories: Custom transaction categories
```

### Debugging

DevTools automatically open in development mode. To enable/disable, modify `src/main/main.ts`:
```typescript
// Open DevTools in development only
if (process.env.NODE_ENV === "development" || !app.isPackaged) {
  mainWindow.webContents.openDevTools();
}
```

### Running Tests

```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run tests with coverage report
yarn test:coverage
```

### Development Scripts

```bash
# Compile TypeScript
yarn compile

# Compile TypeScript in watch mode
yarn compile:watch

# Build CSS (Tailwind)
yarn build:css

# Build CSS in watch mode
yarn build:css:watch

# Development with auto-reload (requires additional setup)
yarn dev:watch

# Reset database (macOS)
yarn reset-db

# Check for security vulnerabilities
yarn security-check
```

### Modifying the App

- **UI Changes**: Edit `src/views/index.html`
- **Styling**: Edit `src/styles/input.css` (Tailwind CSS with DaisyUI)
- **Application Logic**: Edit `src/renderer/app.js`
- **Database Operations**: Edit `src/main/db.ts`
- **Encryption**: Edit `src/main/encryption-manager.ts`
- **Main Process**: Edit `src/main/main.ts`
- **IPC Bridge**: Edit `src/preload/preload.ts`
- **Build Settings**: Edit `package.json` under `"build"`
- **Tailwind Config**: Edit `config/tailwind.config.js`

---

## Troubleshooting

### Common Issues

**Lost encryption key:**
- **Prevention**: Always save your encryption key when shown during onboarding
- **Recovery**: If you lose the key, exported database files cannot be decrypted
- **Note**: The key is stored securely on your device, so you only need the backup for export/import operations

**App won't start:**
- Ensure all dependencies are installed: `yarn install`
- Check Node.js version: `node --version` (should be v16+)

**Build fails:**
- On macOS: You may need Xcode Command Line Tools
- On Windows: You may need Windows Build Tools

**Data not saving:**
- Check file permissions in the app data directory
- Ensure disk space is available

---

## Future Enhancements

- [x] Category management for transactions *(Implemented)*
- [x] Transaction editing and deletion *(Implemented)*
- [x] Search and filtering *(Implemented)*
- [ ] Multi-account balance tracking UI
- [ ] Budget tracking and reports
- [ ] Export to CSV/PDF (currently .enc only)
- [ ] Cloud backup option
- [ ] Mobile companion app
- [ ] Advanced reconciliation algorithms
- [ ] Recurring transaction templates
- [ ] Bill payment reminders
- [ ] Financial reporting and analytics
- [ ] Transaction attachments (receipts, invoices)
- [ ] Custom category icons and colors
- [ ] Transaction tags and notes

---

## Resources

- **Electron Docs**: https://www.electronjs.org/docs/latest/
- **TypeScript Docs**: https://www.typescriptlang.org/docs/

---

## License

MIT License

Copyright (c) 2025 BankRec Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## Contributing

Contributions are welcome! However, please note:
- This project is provided as-is with no guarantees
- Contributors accept the same disclaimer as users
- No warranty or support is implied by accepting contributions
- By contributing, you agree to license your contributions under the MIT License

---

**Happy reconciling! 💰**

*Remember: Always backup your financial data and review code before trusting it with sensitive information.*

# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Fixed

- **Onboarding screen appearing after completion**: Fixed an issue where the onboarding screen would reappear even after users had completed setup. This was caused by:
  - Volatile `os.hostname()` in machine ID calculation that could change with DHCP on macOS
  - Race conditions between encryption key retrieval and database initialization
  - Lack of retry logic when keychain access was temporarily unavailable
  - Database being closed when window closed on macOS, causing onboarding to show when reopening from dock/Spotlight

#### Technical Changes:

**`src/main/encryption-manager.ts`**:
- Removed `os.hostname()` from `getMachineId()` calculation to prevent key retrieval failures when hostname changes
- Added detailed logging throughout key storage and retrieval process for better debugging
- Machine ID now uses only stable attributes: platform, architecture, home directory, and user data path

**`src/main/main.ts`**:
- Added retry logic to `initializeDatabase()` with 3 retry attempts and 500ms delays
- Enhanced `load-data` IPC handler to retry database initialization if not ready
- Added comprehensive logging for database initialization states
- Improved error messages to distinguish between "no key" and "onboarding needed"
- Fixed macOS-specific behavior: database now stays open when window is closed (app running in dock)
- Added database reinitialization check in `activate` event handler for window reopening

### Improved

- **Diagnostic logging**: Added console logs throughout the encryption and database initialization flow to help diagnose future issues
- **Resilience**: App now handles temporary keychain access issues more gracefully with automatic retries

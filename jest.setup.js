// Jest setup file for global test configuration

// Increase timeout for slower tests if needed
jest.setTimeout(10000);

// Mock electron module
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((name) => {
      if (name === 'userData') {
        return '/tmp/test-bankrec';
      }
      return '/tmp';
    }),
    on: jest.fn(),
    whenReady: jest.fn(() => Promise.resolve()),
  },
  BrowserWindow: jest.fn(),
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
  },
}));

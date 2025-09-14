import '@testing-library/jest-dom';

// Mock Electron API for testing
Object.defineProperty(window, 'electronAPI', {
  value: {
    keychainHelper: {
      isAvailable: jest.fn().mockResolvedValue(true),
      storeAuthSafe: jest.fn().mockResolvedValue(true),
      getAuthSafe: jest.fn().mockResolvedValue(null),
      clearAuthSafe: jest.fn().mockResolvedValue(true),
    },
    apiRequest: jest.fn(),
    ipc: {
      invoke: jest.fn(),
    },
  },
  writable: true,
});

// Mock localStorage and sessionStorage to ensure they're never used
const createStorageMock = (name: string) => ({
  getItem: jest.fn((key) => {
    throw new Error(`SECURITY VIOLATION: Attempt to read ${key} from ${name}`);
  }),
  setItem: jest.fn((key, value) => {
    throw new Error(`SECURITY VIOLATION: Attempt to store ${key}=${value} in ${name}`);
  }),
  removeItem: jest.fn((key) => {
    throw new Error(`SECURITY VIOLATION: Attempt to remove ${key} from ${name}`);
  }),
  clear: jest.fn(() => {
    throw new Error(`SECURITY VIOLATION: Attempt to clear ${name}`);
  }),
  length: 0,
  key: jest.fn(() => null),
});

// Replace browser storage with security-monitoring mocks
Object.defineProperty(window, 'localStorage', {
  value: createStorageMock('localStorage'),
  writable: true,
});

Object.defineProperty(window, 'sessionStorage', {
  value: createStorageMock('sessionStorage'),
  writable: true,
});

// Mock keytar for Node.js tests
jest.mock('keytar', () => ({
  getPassword: jest.fn(),
  setPassword: jest.fn(),
  deletePassword: jest.fn(),
  findCredentials: jest.fn().mockResolvedValue([]),
}));

// Mock crypto module
jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue(Buffer.from('mock-random-bytes')),
  createCipherGCM: jest.fn(),
  createDecipherGCM: jest.fn(),
}));

// Mock electron-log
jest.mock('electron-log', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Global test utilities
global.testUtils = {
  // Helper to check if any storage was accessed
  verifyNoStorageUsed: () => {
    expect(localStorage.getItem).not.toHaveBeenCalled();
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(sessionStorage.getItem).not.toHaveBeenCalled();
    expect(sessionStorage.setItem).not.toHaveBeenCalled();
  },
};

// Clear all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

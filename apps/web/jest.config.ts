import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  dir: './',
});

const config: Config = {
  collectCoverage: true,
  coverageReporters: [
    'json',
    'lcov',
    'text-summary',
    'text',
  ],
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.stories.tsx",
  ],
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/*.test.[jt]s?(x)', '**/*.spec.[jt]s?(x)'],
};

export default createJestConfig(config);

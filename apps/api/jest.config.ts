import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverage: true,
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.module.ts',
    '!main.ts',
    '!**/*.dto.ts',
    '!**/*.entity.ts',
  ],
  coverageDirectory: '../coverage',
  coverageReporters: ['json', 'lcov', 'text-summary', 'text'],
  testEnvironment: 'node',
};

export default config;
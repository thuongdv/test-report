/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  // @octokit/rest ships ESM-only; we must transform it for Jest CJS mode
  transformIgnorePatterns: [
    'node_modules/(?!(@octokit|universal-user-agent|before-after-hook)/)',
  ],
  testEnvironment: 'node',
  collectCoverageFrom: ['agents/**/*.ts', '!agents/**/*.spec.ts', '!agents/cli.ts'],
  coverageDirectory: '../coverage/scripts',
};

/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: {
          allowJs: true,
        },
      },
    ],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@octokit|universal-user-agent|before-after-hook)/)',
  ],
  testEnvironment: 'node',
  collectCoverageFrom: ['agents/**/*.ts', '!agents/**/*.spec.ts', '!agents/cli.ts'],
  coverageDirectory: '../coverage/scripts',
};

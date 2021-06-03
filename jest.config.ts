import type { Config } from '@jest/types';

// Sync object
const config: Config.InitialOptions = {
  verbose: true,
  roots: ['<rootDir>/src'],
  testPathIgnorePatterns: ['__tests__/helpers/',],
  collectCoverage: true,
  collectCoverageFrom: [
      "src/**/*.ts"
  ],
  coveragePathIgnorePatterns: [
      "node_modules",
      "test-config",
      "__tests__",
      "src/types.ts",
      "src/index.ts",
      "src/grpc/types",
  ],
};
export default config;

const commonConfig = {
  'roots': [
    '<rootDir>/src'
  ],
  'transform': {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  'globals': {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json'
    }
  },
  'moduleNameMapper': {
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/src/__mocks__/fileMock.js',
    '\\.(css|less)$': '<rootDir>/src/__mocks__/styleMock.js'
  }
};

module.exports = {
  projects: [
    {
      displayName: 'server',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/tests/app/**/*.(spec|test).[jt]s?(x)', '<rootDir>/src/tests/lib/**/*.(spec|test).[jt]s?(x)'],
      testPathIgnorePatterns: ['\\.e2e\\.(spec|test)\\.[jt]sx?$'],
      ...commonConfig,
    },
    {
      displayName: 'web',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/src/tests/web/**/*.(spec|test).[jt]s?(x)'],
      ...commonConfig,
    },
    {
      displayName: 'e2e',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/tests/**/*.e2e.(spec|test).[jt]s?(x)'],
      testTimeout: 30000,
      ...commonConfig,
    },
  ],
};
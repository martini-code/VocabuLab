module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx)$': [
      'babel-jest',
      {
        presets: [require.resolve('@babel/preset-typescript')],
        plugins: [
          [require.resolve('@babel/plugin-transform-react-jsx'), { runtime: 'automatic' }],
          require.resolve('@babel/plugin-transform-modules-commonjs'),
        ],
      },
    ],
  },
  roots: ['<rootDir>/src'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
    '^react-native$': '<rootDir>/tests/mocks/react-native.tsx',
    '^better-sqlite3$': '<rootDir>/tests/mocks/better-sqlite3.ts',
    '^expo-secure-store$': '<rootDir>/tests/mocks/expo-secure-store.ts',
  },
  watchman: false,
  haste: {
    enableSymlinks: false,
    throwOnModuleCollision: false,
  },
};

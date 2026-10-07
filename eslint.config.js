// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*', '.expo/*', 'coverage/*'],
  },
  {
    rules: {
      // React Compiler rules from eslint-plugin-react-hooks v7. Existing screens declare their
      // loaders below the effects that call them; tracked as warnings until those are refactored.
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    files: ['**/__tests__/**', 'tests/**'],
    rules: {
      // Inline jest.mock component factories are anonymous by design.
      'react/display-name': 'off',
      // better-sqlite3 is mapped to tests/mocks via jest moduleNameMapper.
      'import/no-unresolved': ['error', { ignore: ['^better-sqlite3$'] }],
    },
  },
  {
    files: ['scripts/**/*.js', 'tests/**/*.js', '*.config.js', 'plugins/**/*.js'],
    languageOptions: { globals: globals.node },
  },
]);

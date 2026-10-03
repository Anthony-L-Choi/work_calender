import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'dist/'] },
  js.configs.recommended,
  {
    files: ['js/**/*.js', 'sw.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.serviceworker } },
  },
  {
    files: ['tools/**/*.mjs', '.claude/hooks/**/*.mjs', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
];

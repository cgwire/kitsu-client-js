import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default [
  { ignores: ['types/**', 'node_modules/**'] },
  js.configs.recommended,
  prettier,
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {
      'func-style': ['error', 'expression'],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ContinueStatement',
          message: 'No continue: nest the condition.'
        }
      ]
    }
  },
  // Node-only scripts may use top-level await (ES2022); src/ may not.
  { files: ['scripts/**'], languageOptions: { ecmaVersion: 2022 } }
]

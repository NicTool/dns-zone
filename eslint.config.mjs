import globals from 'globals'
import js from '@eslint/js'

export default [
  {
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.mocha,
      },
      sourceType: 'module',
    },

    rules: {
      // 'no-undef': [ 'warn' ],
      'no-unused-vars': [
        'error',
        {
          args: 'none',
        },
      ],

      'dot-notation': 'error',
      'prefer-const': 'warn',
    },
  },
  js.configs.recommended,
]

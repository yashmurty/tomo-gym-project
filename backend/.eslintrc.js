module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin', 'simple-import-sort'],
  extends: [
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'simple-import-sort/imports': 'error',
  },
  overrides: [
    {
      // MCP tool handlers get no database access: they call services, which
      // own validation, ACL and short transactions (roadmap Step 4).
      files: ['src/mcp/tools/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['typeorm', '@nestjs/typeorm'],
                message:
                  'Tools must not touch the database; call a service instead.',
              },
              {
                group: ['**/repositories/*'],
                message:
                  'Tools must not use repositories; call a service instead.',
              },
            ],
          },
        ],
      },
    },
  ],
};

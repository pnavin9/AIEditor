module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', project: false },
  plugins: ['@typescript-eslint', 'import', 'jsdoc'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:jsdoc/recommended',
    'prettier',
  ],
  settings: {
    'import/resolver': {
      node: { extensions: ['.js', '.ts'] },
    },
  },
  rules: {
    'no-console': 'off',
    'jsdoc/require-param': 'off',
    'jsdoc/require-returns': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    'import/no-unresolved': [
      'error',
      {
        ignore: ['.*\\?raw$'],
      },
    ],
  },
  overrides: [
    {
      files: ['server.cjs'],
      env: { node: true },
    },
  ],
  ignorePatterns: ['node_modules/', 'dist/'],
};


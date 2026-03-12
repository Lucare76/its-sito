module.exports = {
  root: true,
  env: {
    browser: false,
    node: false,
    es2021: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'script',
  },
  ignorePatterns: ['node_modules/', 'data/', 'styles/generated.css', 'src/styles/generated.css'],
  overrides: [
    {
      files: ['server.js', 'tools/**/*.js', '*.config.js'],
      env: {
        node: true,
      },
    },
    {
      files: ['scripts/**/*.js', 'src/scripts/**/*.js'],
      env: {
        browser: true,
      },
    },
  ],
  rules: {
    'no-console': 'off',
  },
};

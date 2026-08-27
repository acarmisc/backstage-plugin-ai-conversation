const { createConfigForRole } = require('@backstage/cli/config/eslint-factory');

module.exports = createConfigForRole(__dirname, 'frontend-plugin', {
  rules: {
    'no-restricted-syntax': 'off',
    'no-restricted-imports': 'off',
    eqeqeq: ['error', 'smart'],
  },
});
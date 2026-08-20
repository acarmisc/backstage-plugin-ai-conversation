const { createConfigForRole } = require('@backstage/cli/config/eslint-factory');

module.exports = createConfigForRole(__dirname, 'backend-plugin');

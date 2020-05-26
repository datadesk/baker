// native
const { promisify } = require('util');

// packages
const rimraf = require('rimraf');

module.exports = { rimraf: promisify(rimraf) };

// native
const fs = require('fs');
const path = require('path');

const appDirectory = fs.realpathSync(process.cwd());

function resolveApp(relativePath) {
  return path.resolve(appDirectory, relativePath);
}

module.exports = {
  polyfillsLegacy: resolveApp('lib/polyfills/legacy.js'),
  polyfillsModern: resolveApp('lib/polyfills/modern.js'),
};

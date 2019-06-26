// native
const path = require('path');

function createStaticBlock(pathPrefix, manifest) {
  return function static(filepath) {
    return path.resolve(
      pathPrefix,
      manifest[filepath] ? manifest[filepath] : filepath
    );
  };
}

module.exports = { createStaticBlock };

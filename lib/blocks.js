// native
const path = require('path');

function createStaticBlock(pathPrefix) {
  return function static(filepath) {
    return path.resolve(pathPrefix, filepath);
  };
}

module.exports = { createStaticBlock };

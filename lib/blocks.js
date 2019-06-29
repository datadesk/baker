// native
const path = require('path');

// packages
const fs = require('fs-extra');

function createStaticBlock(pathPrefix, manifest = {}) {
  return function static(filepath) {
    return path.resolve(
      pathPrefix,
      manifest[filepath] ? manifest[filepath] : filepath
    );
  };
}

async function inject(filepath, cb) {
  try {
    const contents = await fs.readFile(filepath, 'utf8');

    cb(null, contents);
  } catch (err) {
    cb(err);
  }
}

inject.async = true;

module.exports = { createStaticBlock, inject };

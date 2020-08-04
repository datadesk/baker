// native
const { join, relative, resolve } = require('path');

// local
const { isProductionEnv } = require('../env');

function createStaticBlock(cwd, pathPrefix, sources) {
  return function static(file) {
    // de-absolute the path if necessary
    file = relative(cwd, join(cwd, file));

    // first we try to find it in our sources
    for (const source of sources) {
      if (file in source.manifest) {
        return resolve(pathPrefix, source.manifest[file]);
      }
    }

    // if we're in production mode, throw an error
    if (isProductionEnv) {
      throw new Error(
        `A static block tried to load a file that does not exist: ${file}`
      );
    }

    // otherwise we are fine with reusing this path
    return resolve(pathPrefix, file);
  };
}

function createStaticAbsoluteBlock(cwd, domain, pathPrefix, sources) {
  // reuse our logic from createStaticBlock
  const static = createStaticBlock(cwd, pathPrefix, sources);

  // return our absolute pathing wrapper around the static tag
  return function staticAbsolute(file) {
    const path = static(file);

    const url = new URL(path, domain);
    return url.toString();
  };
}

module.exports = { createStaticAbsoluteBlock, createStaticBlock };

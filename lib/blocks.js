// native
const path = require('path');

// packages
const fs = require('fs-extra');

// local
const { isProductionEnv } = require('./env');

function createStaticBlock(pathPrefix, sources) {
  return function static(file) {
    // first we try to find it in our sources
    for (const source of sources) {
      if (file in source.manifest) {
        return path.resolve(pathPrefix, source.manifest[file]);
      }
    }

    // if we're in production mode, throw an error
    if (isProductionEnv) {
      throw new Error(
        `The static block tried to load a file that does not exist: ${file}`
      );
    }

    // otherwise we are fine with reusing this path
    return path.resolve(pathPrefix, file);
  };
}

function createScriptBlock(pathPrefix, source) {
  return function script(entry) {
    const { manifest } = source;
    const output = [];

    output.push(
      `<script type="module" src="${path.resolve(
        pathPrefix,
        manifest['modern'][entry]
      )}"></script>`
    );

    if ('legacy' in manifest) {
      output.push(
        `<script nomodule defer src="${path.resolve(
          pathPrefix,
          manifest['legacy'][entry]
        )}"></script>`
      );
    }

    return output.join('\n') + '\n';
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

module.exports = { createScriptBlock, createStaticBlock, inject };

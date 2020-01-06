// native
const { join, relative, resolve } = require('path');

// packages
const fs = require('fs-extra');

// local
const { isProductionEnv } = require('./env');

function createStaticBlock(cwd, pathPrefix, sources, domain) {
  return function static(file, asAbsolute) {
    // de-absolute the path if necessary
    file = relative(cwd, join(cwd, file));

    // first we try to find it in our sources
    for (const source of sources) {
      if (file in source.manifest) {
        const path = resolve(pathPrefix, source.manifest[file]);

        if (asAbsolute) {
          const url = new URL(path, domain);
          return url.toString();
        }

        return path;
      }
    }

    // if we're in production mode, throw an error
    if (isProductionEnv) {
      throw new Error(
        `The static block tried to load a file that does not exist: ${file}`
      );
    }

    // otherwise we are fine with reusing this path
    const path = resolve(pathPrefix, file);

    if (asAbsolute) {
      const url = new URL(path, domain);
      return url.toString();
    }

    return path;
  };
}

function createScriptBlock(pathPrefix, source) {
  return function script(entry) {
    const { manifest } = source;
    const output = [];

    output.push(
      `<script type="module" src="${resolve(
        pathPrefix,
        manifest['modern'][entry]
      )}"></script>`
    );

    if ('legacy' in manifest) {
      output.push(
        `<script nomodule defer src="${resolve(
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

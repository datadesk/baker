// native
const { join, relative, resolve } = require('path');

// packages
const fs = require('fs-extra');

// local
const { isProductionEnv } = require('./env');

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

function createScriptBlock(pathPrefix, source) {
  return function script(entry, shouldPreload = false) {
    const { manifest } = source;
    const output = [];

    if (shouldPreload) {
      manifest.preloads.forEach(preload => {
        output.push(
          `<link rel="preload" href="${resolve(
            pathPrefix,
            preload
          )}" as="script" crossorigin>`
        );
      });
    }

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

function createInjectBlock(inputDir, outputDir, sources) {
  function inject(file, cb) {
    let path;

    // we try to find it in our sources
    for (const source of sources) {
      if (file in source.manifest) {
        path = source.manifest[file];
      }
    }

    if (path) {
      const absolutePath = join(outputDir, path);

      fs.readFile(absolutePath, 'utf8', cb);
    } else {
      if (isProductionEnv) {
        cb(
          new Error(
            `The inject block tried to load a file that does not exist: ${file}`
          )
        );
      } else {
        fs.readFile(join(inputDir, file), 'utf8', cb);
      }
    }
  }

  inject.async = true;

  return inject;
}

module.exports = {
  createInjectBlock,
  createScriptBlock,
  createStaticBlock,
  createStaticAbsoluteBlock,
};

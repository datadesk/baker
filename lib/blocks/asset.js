// native
const fs = require('fs');
const path = require('path');

// packages
const debug = require('debug');

// local
const { isProductionEnv } = require('../env');
const { getRevHash } = require('../utils');

const logger = debug('baker:blocks:asset');

function createAssetBlock(source, dist, pathPrefix, domain) {
  // keep track of assets already processed so we don't repeat work
  const FILE_CACHE = new Map();

  return function asset(filepath, { absolute = false } = {}) {
    // resolve the path relative to the source directory
    const pathToFile = path.resolve(source, filepath);

    if (this.addDependency) {
      this.addDependency(pathToFile, path.resolve(source, this.page.inputPath));
    }

    // we're in dev mode, just short circuit this and let the file server handle
    if (!isProductionEnv) {
      const input = path.resolve(pathPrefix, filepath);

      logger('skipping (dev mode):', input);
      return input;
    }

    let outputPath;

    // if we've already processed this, just spit out the path
    if (FILE_CACHE.has(pathToFile)) {
      logger('using cache:', pathToFile);
      outputPath = FILE_CACHE.get(pathToFile);
    } else {
      // create the project-relative path for HTML
      logger('new file:', pathToFile);

      // get the hash of the file
      const hash = getRevHash(fs.readFileSync(pathToFile));

      // create the new file path with the output
      const { dir, ext, name } = path.parse(filepath);
      filepath = path.format({ dir, ext, name: `${name}.${hash}` });

      // create the output path
      const fileOutput = path.resolve(dist, filepath);

      // make sure that directory exists
      fs.mkdirSync(path.dirname(fileOutput), { recursive: true });

      // copy the file over
      fs.copyFileSync(pathToFile, fileOutput);

      // build the path for the HTML
      outputPath = path.resolve(pathPrefix, filepath);

      // track that we've already seen this and processed it
      FILE_CACHE.set(pathToFile, outputPath);
    }

    // account for the absolute flag
    const output = absolute
      ? new URL(outputPath, domain).toString()
      : outputPath;

    // return the new path
    return output;
  };
}

module.exports = { createAssetBlock };

// native
const { createHash } = require('crypto');
const { createReadStream } = require('fs');
const fs = require('fs').promises;
const path = require('path');

// packages
const debug = require('debug');

// local
const { isProductionEnv } = require('../env');
const { ensureDir } = require('../utils');

const logger = debug('baker:blocks:asset');

function createAssetBlock(source, dist, pathPrefix) {
  // keep track of assets already processed so we don't repeat work
  const FILE_CACHE = new Map();

  async function asset(filepath) {
    // resolve the path relative to the source directory
    const pathToFile = path.resolve(source, filepath);

    // if we've already processed this, just spit out the path
    if (FILE_CACHE.has(pathToFile)) {
      logger('using cache:', pathToFile);
      return FILE_CACHE.get(pathToFile);
    }
    // create the project-relative path for HTML
    logger('new file:', pathToFile);

    // get the hash of the file
    const hash = await getHashFromStream(createReadStream(pathToFile));

    // create the new file path with the output
    const { dir, ext, name } = path.parse(filepath);
    filepath = path.format({ dir, ext, name: `${name}.${hash}` });

    // create the output path
    const fileOutput = path.resolve(dist, filepath);

    // make sure that directory exists
    await ensureDir(fileOutput);

    // copy the file over
    await fs.copyFile(pathToFile, fileOutput);

    // build the path for the HTML
    const output = path.resolve(pathPrefix, filepath);

    // track that we've already seen this and processed it
    FILE_CACHE.set(pathToFile, output);

    // return the new path
    return output;
  }

  asset.async = true;

  return asset;
}

function getHashFromStream(stream) {
  return new Promise((resolve, reject) => {
    stream
      .on('error', reject)
      .pipe(createHash('md5').setEncoding('hex'))
      .on('error', reject)
      .on('finish', function () {
        resolve(this.read().slice(0, 8));
      });
  });
}

module.exports = { createAssetBlock };

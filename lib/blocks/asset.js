// native
import { readFileSync, mkdirSync, copyFileSync } from 'fs';
import { resolve, parse, format, dirname } from 'path';

// packages
import debug from 'debug';

// local
import { isProductionEnv } from '../env.js';
import { getRevHash } from '../utils.js';

const logger = debug('baker:blocks:asset');

export function createAssetBlock(source, dist, pathPrefix, domain) {
  // keep track of assets already processed so we don't repeat work
  const FILE_CACHE = new Map();

  return function asset(filepath, { absolute = false } = {}) {
    // resolve the path relative to the source directory
    const pathToFile = resolve(source, filepath);

    if (this.addDependency) {
      this.addDependency(pathToFile, resolve(source, this.page.inputPath));
    }

    // we're in dev mode, just short circuit this and let the file server handle
    if (!isProductionEnv) {
      const input = resolve(pathPrefix, filepath);

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
      const hash = getRevHash(readFileSync(pathToFile));

      // create the new file path with the output
      const { dir, ext, name } = parse(filepath);
      filepath = format({ dir, ext, name: `${name}.${hash}` });

      // create the output path
      const fileOutput = resolve(dist, filepath);

      // make sure that directory exists
      mkdirSync(dirname(fileOutput), { recursive: true });

      // copy the file over
      copyFileSync(pathToFile, fileOutput);

      // build the path for the HTML
      outputPath = resolve(pathPrefix, filepath);

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

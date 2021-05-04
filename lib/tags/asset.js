// native
import { copyFileSync, mkdirSync, readFileSync } from 'fs';
import { dirname, format, parse, resolve } from 'path';

// packages
import debug from 'debug';

// local
import { getRevHash } from '../utils.js';

const logger = debug('baker:tags:asset');

/**
 * Returns true if the string is a valid URL.
 *
 * @param {string} str The string to test
 */
function isFullUrl(str) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {Object} options
 * @param {string} options.input
 * @param {import('../types').BakerMode} options.mode
 * @param {string} options.output
 * @param {string} options.pathPrefix
 * @param {string} options.staticRoot
 * @param {string} [options.domain]
 */
export function createAssetTag({
  input,
  mode,
  output,
  pathPrefix,
  staticRoot,
  domain,
}) {
  // keep track of assets already processed so we don't repeat work
  const FILE_CACHE = new Map();

  return function asset(filepath, { absolute = false } = {}) {
    // if the provided file is an actual URL, just pass it through
    if (isFullUrl(filepath)) {
      return filepath;
    }

    // resolve the path relative to the source directory
    const pathToFile = resolve(input, filepath);

    // we're in dev mode, just short circuit this and let the file server handle
    if (mode === 'development') {
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
      const fileOutput = resolve(output, staticRoot, filepath);

      // make sure that directory exists
      mkdirSync(dirname(fileOutput), { recursive: true });

      // copy the file over
      copyFileSync(pathToFile, fileOutput);

      // build the path for the HTML
      outputPath = resolve(pathPrefix, staticRoot, filepath);

      // track that we've already seen this and processed it
      FILE_CACHE.set(pathToFile, outputPath);
    }

    // account for the absolute flag
    outputPath = absolute ? new URL(outputPath, domain).toString() : outputPath;

    // return the new path
    return outputPath;
  };
}

// native
import { join, relative, resolve } from 'path';

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

export function createStaticTag(cwd, pathPrefix, sources) {
  return function static_(file) {
    // if the provided file is an actual URL, just pass it through
    if (isFullUrl(file)) {
      return file;
    }

    // de-absolute the path if necessary
    file = relative(cwd, join(cwd, file));

    // first we try to find it in our sources
    for (const source of sources) {
      if (file in source.manifest) {
        return resolve(pathPrefix, source.manifest[file]);
      }
    }

    // if it gets this far that file didn't exist
    throw new Error(
      `A static block tried to load a file that does not exist: ${file}`
    );
  };
}

export function createStaticAbsoluteTag(cwd, domain, pathPrefix, sources) {
  // reuse our logic from createStaticTag
  const static_ = createStaticTag(cwd, pathPrefix, sources);

  // return our absolute pathing wrapper around the static tag
  return function staticAbsolute(file) {
    const path = static_(file);

    const url = new URL(path, domain);
    return url.toString();
  };
}

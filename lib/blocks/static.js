// native
import { join, relative } from 'path';

/**
 * Returns true if the string is a valid URL.
 *
 * @param {string} str The string to test
 */
export function isFullUrl(str) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

export function createStaticBlock(cwd, engines) {
  return function _static(file) {
    return getStaticPath(file, cwd, engines);
  };
}

export function getStaticPath(file, cwd, engines) {
  if (isFullUrl(file)) {
    return file;
  }

  // de-absolute the path if necessary
  file = relative(cwd, join(cwd, file));

  // first we try to find it in our sources
  for (const engine of engines) {
    const entry = engine.getManifestEntry(file);
    if (entry) {
      return getStaticPathFromManifestEntry(engine, entry);
    }
  }

  // if it gets this far that file didn't exist
  throw new Error(
    `A static block tried to load a file that does not exist in provided sources: ${file}`
  );
}

export function getStaticPathFromManifestEntry(engine, entry) {
  const { basePath } = engine;
  if (basePath.endsWith('/') && entry.startsWith('/')) {
    return `${basePath}${entry.slice(1)}`;
  }

  return `${basePath}${entry}`;
}

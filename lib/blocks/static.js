// native
import { join, relative, resolve } from 'path';

export function createStaticBlock(cwd, pathPrefix, sources) {
  return function static_(file) {
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

export function createStaticAbsoluteBlock(cwd, domain, pathPrefix, sources) {
  // reuse our logic from createStaticBlock
  const static_ = createStaticBlock(cwd, pathPrefix, sources);

  // return our absolute pathing wrapper around the static tag
  return function staticAbsolute(file) {
    const path = static_(file);

    const url = new URL(path, domain);
    return url.toString();
  };
}

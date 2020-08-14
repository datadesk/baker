// native
const { readFile } = require('fs');
const { join } = require('path');

function createInjectBlock(outputDir, sources) {
  function inject(file, cb) {
    let path;

    // we try to find it in our sources
    for (const source of sources) {
      if (file in source.manifest) {
        path = source.manifest[file];
        break;
      }
    }

    if (path) {
      const absolutePath = join(outputDir, path);

      readFile(absolutePath, 'utf8', cb);
    } else {
      cb(
        new Error(
          `The inject block tried to load a file that does not exist: ${file}`
        )
      );
    }
  }

  inject.async = true;

  return inject;
}

module.exports = { createInjectBlock };

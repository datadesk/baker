// native
const path = require('path');

// packages
const fs = require('fs-extra');

function createStaticBlock(pathPrefix, manifest = {}) {
  return function static(filepath) {
    if (filepath in manifest.static) {
      return path.resolve(pathPrefix, manifest.static[filepath]);
    } else {
      throw new Error(
        `The static block tried to load a file that does not exist: ${filepath}`
      );
    }
  };
}

function createScriptBlock(pathPrefix, manifest = {}) {
  return function script(entry, type = 'modern') {
    const output = [];

    if (type === 'legacy') {
      output.push(
        `<script nomodule src="${path.resolve(
          pathPrefix,
          manifest.scripts.loader
        )}"></script>`
      );

      output.push('<script nomodule>');
      output.push(
        `  System.import('${path.resolve(
          pathPrefix,
          manifest.scripts[type][entry]
        )}');`
      );
      output.push('</script>');
    } else {
      output.push(
        `<script type="module" src="${path.resolve(
          pathPrefix,
          manifest.scripts[type][entry]
        )}"></script>`
      );
    }

    return output.join('\n');
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

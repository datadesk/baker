// native
const path = require('path');

// packages
const fs = require('fs-extra');

function createStaticBlock(pathPrefix, sources) {
  return function static(file) {
    for (const source of sources) {
      if (file in source.manifest) {
        return path.resolve(pathPrefix, source.manifest[file]);
      }
    }

    throw new Error(
      `The static block tried to load a file that does not exist: ${file}`
    );
  };
}

function createScriptBlock(pathPrefix, source) {
  return function script(entry, type = 'modern') {
    const { manifest } = source;
    const output = [];

    if (type === 'legacy') {
      output.push(
        `<script nomodule src="${path.resolve(
          pathPrefix,
          manifest.loader
        )}"></script>`
      );

      output.push('<script nomodule>');
      output.push(
        `  System.import('${path.resolve(pathPrefix, manifest[type][entry])}');`
      );
      output.push('</script>');
    } else {
      output.push(
        `<script type="module" src="${path.resolve(
          pathPrefix,
          manifest[type][entry]
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

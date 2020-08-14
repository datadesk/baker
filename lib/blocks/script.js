// native
const { resolve } = require('path');

function createScriptBlock(pathPrefix, source) {
  return function script(entry, shouldPreload = false) {
    const { manifest } = source;
    const output = [];

    if (shouldPreload) {
      manifest.preloads.forEach((preload) => {
        output.push(
          `<link rel="preload" href="${resolve(
            pathPrefix,
            preload
          )}" as="script" crossorigin>`
        );
      });
    }

    output.push(
      `<script type="module" src="${resolve(
        pathPrefix,
        manifest['modern'][entry]
      )}"></script>`
    );

    if ('legacy' in manifest) {
      output.push(
        `<script nomodule defer src="${resolve(
          pathPrefix,
          manifest['legacy'][entry]
        )}"></script>`
      );
    }

    return output.join('\n') + '\n';
  };
}

module.exports = { createScriptBlock };

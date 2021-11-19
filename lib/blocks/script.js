// native
import debug from 'debug';
import { resolve } from 'path';

const logger = debug('baker:blocks:script');

export function createScriptBlock(pathPrefix, source) {
  logger("createScriptBlock init");
  return function script(entry, shouldPreload = false) {
    logger("script block", entry, shouldPreload);

    const { manifest } = source;
    logger("manifest", manifest);

    const modernEntry = manifest.modern[entry];
    const cssEntry = manifest.css[entry];

    const output = [];

    if (!modernEntry) {
      throw new Error(
        `A script block tried to reference an entrypoint that does not exist: ${entry}. It's possible the bundling failed, or "${entry}" was not correctly configured as an entrypoint.`
      );
    }

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

    if (cssEntry) {
      output.push(
        `<link rel="stylesheet" href="${resolve(pathPrefix, cssEntry)}">`
      );
    }

    output.push(
      `<script type="module" src="${resolve(
        pathPrefix,
        modernEntry
      )}"></script>`
    );

    if ('legacy' in manifest) {
      output.push(
        `<script nomodule defer src="${resolve(
          pathPrefix,
          manifest.legacy[entry]
        )}"></script>`
      );
    }

    logger("script blocks", output);
    return output.join('\n') + '\n';
  };
}


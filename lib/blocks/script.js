// native
import debug from 'debug';
import { resolve } from 'path';

const logger = debug('baker:blocks:script');

export function createScriptBlock(pathPrefix, source) {
  logger("createScriptBlock init");
  return function script(entry, shouldPreload = false) {
    logger('script block', entry, shouldPreload);

    const { manifest } = source;
    const { basePath, modern, css, preloads, legacy } = manifest;

    const srcPath = basePath ? [basePath, pathPrefix].join('/') : pathPrefix;

    const modernEntry = modern[entry];
    const cssEntry = css[entry];

    const output = [];

    if (!modernEntry) {
      throw new Error(
        `A script block tried to reference an entrypoint that does not exist: ${entry}. It's possible the bundling failed, or "${entry}" was not correctly configured as an entrypoint.`
      );
    }

    if (shouldPreload) {
      preloads.forEach((preload) => {
        output.push(
          `<link rel="preload" href="${resolve(
            srcPath,
            preload
          )}" as="script" crossorigin>`
        );
      });
    }

    if (cssEntry) {
      output.push(
        `<link rel="stylesheet" href="${resolve(srcPath, cssEntry)}">`
      );
    }

    output.push(
      `<script type="module" src="${resolve(srcPath, modernEntry)}"></script>`
    );

    if ('legacy' in manifest) {
      output.push(
        `<script nomodule defer src="${resolve(srcPath,  legacy[entry]
        )}"></script>`
      );
    }

    logger('script blocks', output);
    return output.join('\n') + '\n';
  };
}


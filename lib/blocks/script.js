// native
import debug from 'debug';
import { resolve } from 'path';
import { isProductionEnv } from '../env.js';
import { removeTrailingSlash } from '../utils.js';

const logger = debug('baker:blocks:script');

export function createScriptBlock(pathPrefix, source) {
  logger("createScriptBlock init");
  return function script(entry, shouldPreload = false) {
    logger('script block', entry, shouldPreload);

    const { manifest } = source;
    const { basePath, modern, css, preloads, legacy } = manifest;
    const pathSrc = !!basePath
      ? [basePath, removeTrailingSlash(pathPrefix)].join('/')
      : pathPrefix;

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
          `<link rel="preload" href="${determineOutput(
            pathSrc,
            preload
          )}" as="script" crossorigin>`
        );
      });
    }

    if (cssEntry) {
      output.push(
        `<link rel="stylesheet" href="${determineOutput(pathSrc, cssEntry)}">`
      );
    }

    output.push(
      `<script type="module" src="${determineOutput(
        pathSrc,
        modernEntry
      )}"></script>`
    );

    if ('legacy' in manifest) {
      const legacyEntry = legacy[entry];
      output.push(
        `<script nomodule defer src="${determineOutput(
          pathSrc,
          legacyEntry
        )}"></script>`
      );
    }

    logger('script blocks', output);
    return output.join('\n') + '\n';
  };
}

function determineOutput(pathSrc, srcType) {
  if (isProductionEnv && process.env.BASE_PATH) {
    return [pathSrc, srcType].join('/');
  }
  return resolve(pathSrc, srcType);
}

// native
import debug from 'debug';
import { getStaticPathFromManifestEntry } from './static.js';

const logger = debug('baker:blocks:script');

export function createScriptBlock(rollup) {
  return function script(entry, shouldPreload = false) {
    console.log('createScriptBlock entry', entry);

    const { manifest } = rollup;
    const { preloads } = manifest;

    const cssEntry = rollup.getManifestEntry(entry);
    const modernEntry = rollup.getManifestEntry(entry);
    const legacyEntry = rollup.getManifestEntry(entry);
    const output = [];

    if (!modernEntry) {
      throw new Error(
        `A script block tried to reference an entrypoint that does not exist: ${entry}. It's possible the bundling failed, or "${entry}" was not correctly configured as an entrypoint.`
      );
    }

    const _static = (entry) => {
      return getStaticPathFromManifestEntry(rollup, entry);
    };;

    if (shouldPreload) {
      preloads.forEach((preload) => {
        output.push(`<link rel="preload" href="${_static(
            preload
          )}" as="script" crossorigin>`);
      });
    }

    if (!!cssEntry) {
      output.push(`<link rel="stylesheet" href="${_static(cssEntry)}">`);
    }

    if (!!modernEntry) {
      output.push(
        `<script type="module" src="${_static(modernEntry)}"></script>`
      );
    }

    if (!!legacyEntry) {
      output.push(
        `<script nomodule defer src="${_static(legacyEntry)}"></script>`
      );
    }

    logger('script blocks', output);
    return output.join('\n') + '\n';
  };
}

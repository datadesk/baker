// native
import debug from 'debug';
import { getStaticPathFromManifestEntry } from './static.js';

const logger = debug('baker:blocks:script');
const ENTRY_TYPES = ['css', 'modern', 'legacy'];

export function createScriptBlock(rollup) {
  return function script(entry, shouldPreload = false) {
    const { manifest } = rollup;
    const { preloads } = manifest;

    const entries = ENTRY_TYPES.reduce((acc, type) => {
      const manifestEntryType = rollup.getManifestEntry(type);
      if (!manifestEntryType) return acc;

      const manifestEntry = manifestEntryType[entry];
      if (!manifestEntry) return acc;

      acc[type] = manifestEntry;
      return acc;
    }, {});

    const {
      css: cssEntry,
      modern: modernEntry,
      legacy: legacyEntry
    } = entries;

    const output = [];

    if (!modernEntry) {
      throw new Error(
        `A script block tried to reference an entrypoint that does not exist: ${entry}. It's possible the bundling failed, or "${entry}" was not correctly configured as an entrypoint.`
      );
    }

    const _static = (entry) => {
      return getStaticPathFromManifestEntry(rollup, entry);
    };

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

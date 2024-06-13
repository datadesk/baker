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
        const preloadPath = [pathPrefix, preload].join('/');
        const preloadUrl = new URL(preloadPath, basePath);
        const resolvedPreload = resolve(pathPrefix, preload);
        output.push(
          `<link rel="preload" href="${
            basePath ? preloadUrl : resolvedPreload
          }" as="script" crossorigin>`
        );
      });
    }

    if (cssEntry) {
      const cssEntryPath = [pathPrefix, cssEntry].join('/');
      const cssEntryUrl = new URL(cssEntryPath, basePath);
      const resolvedCssEntry = resolve(pathPrefix, cssEntry);
      output.push(
        `<link rel="stylesheet" href="${
          basePath ? cssEntryUrl : resolvedCssEntry
        }">`
      );
    }

    const modernEntryPath = [pathPrefix, modernEntry].join('/');
    const modernEntryUrl = new URL(modernEntryPath, basePath);
    const resolvedModernEntry = resolve(pathPrefix, modernEntry);
    output.push(
      `<script type="module" src="${
        basePath ? modernEntryUrl : resolvedModernEntry
      }"></script>`
    );

    if ('legacy' in manifest) {
      const legacyEntry = legacy[entry];
      const legacyEntryPath = [pathPrefix, legacyEntry].join('/');
      const legacyEntryUrl = new URL(legacyEntryPath, basePath);
      const resolvedLegacyEntry = resolve(pathPrefix, legacyEntry);
      output.push(
        `<script nomodule defer src="${
          basePath ? legacyEntryUrl : resolvedLegacyEntry
        }"></script>`
      );
    }

    logger('script blocks', output);
    return output.join('\n') + '\n';
  };
}


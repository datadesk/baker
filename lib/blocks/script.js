// native
import debug from 'debug';

const logger = debug('baker:blocks:script');

export function createScriptBlock(baker) {
  logger("createScriptBlock init");
  return function script(entry, shouldPreload = false) {
    logger("script block", entry, shouldPreload);

    const { manifest } = baker.rollup;
    const {
      modern,
      css,
      preloads,
      legacy
    } = manifest;

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
          `<link rel="preload" href="${baker.getStaticPath(
            preload
          )}" as="script" crossorigin>`
        );
      });
    }

    if (!!cssEntry) {
      output.push(
        `<link rel="stylesheet" href="${baker.getStaticPath(cssEntry)}">`
      );
    }

    if (!!modernEntry) {
      output.push(
        `<script type="module" src="${baker.getStaticPath(
          modernEntry
        )}"></script>`
      );
    }

    if (!!legacy) {
      output.push(
        `<script nomodule defer src="${baker.getStaticPath(
          legacy[entry]
        )}"></script>`
      );
    }

    logger("script blocks", output);
    return output.join('\n') + '\n';
  };
}

// native
import * as path from 'path';

// packages
import * as fs from 'fs-extra';

// local
import { Engine } from './engines/base';
import { isProductionEnv } from './env';

function createStaticBlock(pathPrefix: string, engines: Engine[]) {
  return function staticBlock(file: string) {
    // first we try to find it in our sources
    for (const engine of engines) {
      if (file in engine.manifest) {
        return path.resolve(pathPrefix, engine.manifest[file]);
      }
    }

    // if we're in production mode, throw an error
    if (isProductionEnv) {
      throw new Error(
        `The static block tried to load a file that does not exist: ${file}`
      );
    }

    // otherwise we are fine with reusing this path
    return path.resolve(pathPrefix, file);
  };
}

function createScriptBlock(pathPrefix: string, engine: Engine) {
  return function script(entry: string, type = 'modern') {
    const { manifest } = engine;
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

    return output.join('\n') + '\n';
  };
}

async function inject(filepath: string, cb: Function) {
  try {
    const contents = await fs.readFile(filepath, 'utf8');

    cb(null, contents);
  } catch (err) {
    cb(err);
  }
}

inject.async = true;

module.exports = { createScriptBlock, createStaticBlock, inject };

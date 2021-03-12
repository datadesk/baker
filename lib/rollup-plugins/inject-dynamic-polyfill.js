// native
const { join } = require('path');

// packages
const MagicString = require('magic-string').default;

const polyfillId = '@datagraphics/baker/dynamic-import-polyfill';

function dynamicImportPolyfillPlugin({ base, dir }) {
  const polyfillString = `const p = ${polyfill.toString()};p(${JSON.stringify(
    join(base, dir, '/')
  )});`;

  return {
    name: 'baker:dynamic-import-polyfill',

    resolveId(id) {
      if (id === polyfillId) {
        return id;
      }
    },

    load(id) {
      if (id === polyfillId) {
        return polyfillString;
      }
    },

    transform(code, id) {
      const { isEntry } = this.getModuleInfo(id);

      if (isEntry) {
        const magicString = new MagicString(code);
        magicString.prepend(`import ${JSON.stringify(polyfillId)};`);

        return { code: magicString.toString(), map: magicString.generateMap() };
      }
    },
  };
}

module.exports = { dynamicImportPolyfillPlugin };

/*
  Copyright (c) 2018 uupaa and 2019 Google LLC
  Use of this source code is governed by an MIT-style
  license that can be found in the LICENSE file or at
  https://opensource.org/licenses/MIT.
*/
function polyfill(modulePath = '.', importFunctionName = '__import__') {
  try {
    self[importFunctionName] = new Function('u', `return import(u)`);
  } catch (error) {
    const baseURL = new URL(modulePath, location);
    const cleanup = (script) => {
      URL.revokeObjectURL(script.src);
      script.remove();
    };

    self[importFunctionName] = (url) =>
      new Promise((resolve, reject) => {
        const absURL = new URL(url, baseURL);

        // If the module has already been imported, resolve immediately.
        if (self[importFunctionName].moduleMap[absURL]) {
          return resolve(self[importFunctionName].moduleMap[absURL]);
        }

        const moduleBlob = new Blob(
          [
            `import * as m from '${absURL}';`,
            `${importFunctionName}.moduleMap['${absURL}']=m;`,
          ],
          { type: 'text/javascript' }
        );

        const script = Object.assign(document.createElement('script'), {
          type: 'module',
          src: URL.createObjectURL(moduleBlob),
          onerror() {
            reject(new Error(`Failed to import: ${url}`));
            cleanup(script);
          },
          onload() {
            resolve(self[importFunctionName].moduleMap[absURL]);
            cleanup(script);
          },
        });

        document.head.appendChild(script);
      });

    self[importFunctionName].moduleMap = {};
  }
}

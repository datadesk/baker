// native
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Resolves a relative path against this library's root directory.
 *
 * @param {string} relativePath The desired path relative to this package's directory
 * @returns {string}
 */
function resolveOwn(relativePath) {
  return resolve(__dirname, '..', relativePath);
}

export const polyfillsDynamicImport = resolveOwn(
  'lib/polyfills/dynamic-import.js'
);

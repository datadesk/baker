// native
import { realpathSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

/**
 * The current project's root directory
 *
 * @type {string}
 */
const appDirectory = realpathSync(process.cwd());

/**
 * Resolves a relative path against the current project's root directory.
 *
 * @param {string} relativePath The desired path relative to the app's directory
 * @returns {string}
 */
function resolveApp(relativePath) {
  return resolve(appDirectory, relativePath);
}

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

// native
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { dirname } from 'path';

// packages
import { bold, red, yellow } from 'colorette';

// local
import { inDebugMode } from './env.js';

export function noop() {}

/**
 * @param {string} input
 */
export function getRevHash(input) {
  return createHash('md5').update(input).digest('hex').slice(0, 8);
}

export const isInteractive = process.stdout.isTTY;

export function clearConsole() {
  if (isInteractive && !inDebugMode) {
    process.stdout.write(
      process.platform === 'win32' ? '\x1B[2J\x1B[0f' : '\x1B[2J\x1B[3J\x1B[H'
    );
  }
}

/**
 * @param {{ external?: string, local?: string}} config
 */
export function printInstructions({ external, local }) {
  console.log();
  console.log('You can now view your project in your browser!');
  console.log();

  if (local) {
    console.log(`${bold('Local server URL:')}       ${local}`);
  }

  if (external) {
    console.log(`${bold('URL on your network:')}    ${external}`);
  }

  console.log();
}

export function logErrorMessage(err) {
  if (!Array.isArray(err)) err = [err];

  err.forEach((e) => {
    if (e.message) {
      console.error(e.message);

      if (e.frame) {
        console.error(e.frame);
      }
    } else {
      console.error(e);
    }
  });

  console.log('\n');
}

export function onError(type, err) {
  console.log(red(`${type} failed to compile.\n`));
  logErrorMessage(err);
}

export function onWarning(type, err) {
  console.log(yellow(`${type} compiled with warnings.\n`));
  logErrorMessage(err);
}

/**
 * List of image file extensions for use in tasks.
 *
 * @type {String[]}
 */
export const validImageExtensions = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.svg',
  'avif',
  'webp',
];

/**
 * List of font file extensions we recognize in tasks.
 *
 * @type {String[]}
 */
export const validFontExtensions = ['.woff2', '.woff', '.ttf', '.otf'];

/**
 * List of video file extensions we recognize in tasks.
 *
 * @type {String[]}
 */
export const validVideoExtensions = ['.mp4', '.webm'];

/**
 * List of video file extensions we recognize in tasks.
 *
 * @type {String[]}
 */
export const validAudioExtensions = ['.mp3'];

/**
 * List of JSON file extensions we recognize in tasks.
 *
 * @type {String[]}
 */
export const validJsonExtensions = ['.json', '.geojson', '.topojson'];

/**
 * Takes a file path and ensures all directories in that path exist.
 *
 * @param {string} path The full path of the file to ensure has directories
 * @returns {Promise<void>} If no error is thrown, returns `void`.
 */
export async function ensureDir(path) {
  const dir = dirname(path);

  try {
    await fs.readdir(dir);
  } catch {
    await ensureDir(dir);

    try {
      await fs.mkdir(dir);
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
  }
}

/**
 * Takes a string and writes it out to the provided file path. All directories
 * in the path are created if needed.
 *
 * @param {string} dest The output file path
 * @param {string} data The content to be written to the `dest`
 * @returns {Promise<void>} If no error is thrown, returns `void`.
 */
export async function outputFile(dest, data) {
  await ensureDir(dest);

  try {
    await fs.writeFile(dest, data);
  } catch (e) {
    throw e;
  }
}

/**
 * Checks if the `value` is of type `Object`. (e.g. arrays, functions, objects,
 * regexes, `new Number(0)`, and `new String('')`)
 *
 * @param {*} value The value to check
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 */
export function isObject(value) {
  const type = typeof value;

  return value != null && (type === 'object' || type === 'function');
}

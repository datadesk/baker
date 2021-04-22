// native
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, format, join, parse, resolve } from 'path';

// packages
import debug from 'debug';

// local
import { isProductionEnv } from '../env.js';
import { getRevHash } from '../utils.js';

const logger = debug('baker:tags:style');

/**
 * @param {Object} options
 * @param {string} options.input
 * @param {string} options.output
 * @param {string} options.pathPrefix
 * @param {string} options.staticRoot
 * @param {import('postcss').Plugin[]} [options.postcssPlugins]
 */
export function createStyleTag(
  { input, output, pathPrefix, staticRoot, postcssPlugins = [] },
  context
) {
  // keep track of assets already processed so we don't repeat work
  /** @type {Map<string, string>} */
  const FILE_CACHE = new Map();

  /** @type {Map<string, string[]} */
  const DEPENDENCY_MAP = new Map();

  /** @type {import('sass')} */
  let sass;

  /** @type {import('postcss')} */
  let postcss;

  /** @type {import('clean-css')} */
  let CleanCSS;

  async function renderSass(file, relativePath) {
    sass = sass || (await import('sass').then((module) => module.default));

    /** @type {import('sass').Result} */
    let result;

    // render the Sass file
    try {
      result = sass.renderSync({
        file,
      });
    } catch (err) {
      throw err;
    }

    // grab the CSS result
    let css = result.css.toString();

    for (const dep of result.stats.includedFiles) {
      if (DEPENDENCY_MAP.has(dep)) {
        DEPENDENCY_MAP.get(dep).add(file);
      } else {
        DEPENDENCY_MAP.set(dep, new Set([file]));
      }
    }

    postcss = postcss || (await import('postcss'));

    const postcssResult = await postcss.default(postcssPlugins).process(css, {
      from: relativePath,
    });

    css = postcssResult.css;

    if (isProductionEnv) {
      CleanCSS =
        CleanCSS ||
        (await import('clean-css').then((module) => module.default));

      const cleanResult = new CleanCSS({ rebase: false }).minify(css);
      css = cleanResult.styles;
    }

    return css;
  }

  return async function style(filepath) {
    // resolve the path relative to the source directory
    const file = resolve(input, filepath);

    /** @type {string} */
    let outputPath;

    // if we've already processed this, just spit out the path
    if (FILE_CACHE.has(file)) {
      logger('using cache:', file);
      outputPath = FILE_CACHE.get(file);
    } else {
      // create the project-relative path for HTML
      logger('new file:', file);

      const css = await renderSass(file, filepath);

      // get the hash of the file
      const hash = getRevHash(css);

      // create the new file path with the output
      const { dir, name } = parse(filepath);
      filepath = format({ dir, ext: '.css', name: `${name}.${hash}` });

      // create the output path
      const fileOutput = join(output, staticRoot, filepath);

      // make sure that directory exists
      mkdirSync(dirname(fileOutput), { recursive: true });

      // write out the CSS
      writeFileSync(fileOutput, css);

      // build the path for the HTML
      outputPath = resolve(pathPrefix, staticRoot, filepath);

      // track that we've already seen this and processed it
      FILE_CACHE.set(file, outputPath);
    }

    return outputPath;
  };
}

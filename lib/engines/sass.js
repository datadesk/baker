// native
const path = require('path');

// packages
const fiber = require('fibers');
const fs = require('fs-extra');
const revPath = require('rev-path');
const sass = require('sass');

// local
const { BaseEngine } = require('./base');
const { getRevHash } = require('../utils');

/**
 * A wrapper around sass.render to make it return a Promise for async/await
 * work. An instance of fiber is already provided and passed for you.
 *
 * @param {*} opts parameters for sass.render
 * @returns {Promise}
 */
function renderSass(opts) {
  return new Promise((resolve, reject) => {
    sass.render({ fiber, ...opts }, (err, result) => {
      if (err) reject(err);

      resolve(result);
    });
  });
}

class SassEngine extends BaseEngine {
  constructor({ env = 'development', includePaths, input, output } = {}) {
    super({ input, output });

    // the extensions this engine uses
    this.extensions = ['scss'];

    // the current environment
    this.env = env;

    // the paths to consider when resolving in Sass
    this.includePaths = includePaths;
  }

  async minify(css) {
    // this is a big import, so only load it if necessary
    if (!this.cleaner) {
      const CleanCSS = require('clean-css');

      this.cleaner = new CleanCSS({
        returnPromise: true,
        level: { 1: { specialComments: false }, 2: { all: true } },
      });
    }

    const { styles } = await this.cleaner.minify(css);

    return styles;
  }

  async render(file) {
    const { css } = await renderSass({ file });

    return css.toString();
  }

  async build() {
    const files = await this.findFiles();

    const manifest = {};

    for await (const file of files) {
      // grab the path relative to the source directory
      const input = path.relative(this.input, file);

      // compile the CSS
      const css = await this.render(file);

      // create the hash of the CSS file
      const hash = getRevHash(css);

      // pull the relative path's extension and name
      const { dir, name } = path.parse(input);

      // build the relative output path
      const output = path.format({ dir, name, ext: '.css' });

      // the rev version of the path
      const revOutput = revPath(output, hash);

      // build the absolute output path
      const absolute = path.join(this.output, revOutput);

      // write to disk
      await fs.outputFile(absolute, css);

      // save a reference how the file path was modified
      manifest[output] = revOutput;
    }

    return manifest;
  }
}

module.exports = { SassEngine };

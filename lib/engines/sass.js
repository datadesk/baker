// native
const path = require('path');

// packages
const glob = require('fast-glob');
const fiber = require('fibers');
const fs = require('fs-extra');
const sass = require('sass');

// local
const { BaseEngine } = require('./base');

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

  async publish() {
    const files = await this.findFiles();

    const report = [];

    for (let idx = 0; idx < files.length; idx++) {
      // get the file
      const file = files[idx];

      // grab the path relative to the source directory
      const relativePath = path.relative(this.input, file);

      // pull the relative path's extension and name
      const { dir, name } = path.parse(relativePath);

      const relativeOutputPath = path.format({ dir, name, ext: '.css' });

      // build the output path
      const outputPath = path.join(this.output, relativeOutputPath);

      // compile the CSS
      const css = await this.render(file);

      // write to disk
      await fs.outputFile(outputPath, css);

      report.push({ file, relativePath, relativeOutputPath, outputPath });
    }

    return report;
  }
}

module.exports = { SassEngine };

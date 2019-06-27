// native
const path = require('path');

// packages
const fiber = require('fibers');
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
  constructor({ includePaths, ...args }) {
    super(args);

    // the extensions this engine uses
    this.extensions = ['sass', 'scss'];

    // the paths to consider when resolving in Sass
    this.includePaths = includePaths;
  }

  getOutputPath({ dir, name }) {
    return path.format({ dir, name, ext: '.css' });
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
    const { css } = await renderSass({ file, includePaths: this.includePaths });

    return css.toString();
  }
}

module.exports = { SassEngine };

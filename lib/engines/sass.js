// native
const path = require('path');

// local
const { BaseEngine } = require('./base');
const { isProductionEnv } = require('../env');
const { getRevHash } = require('../utils');

class SassEngine extends BaseEngine {
  constructor({ includePaths, ...args }) {
    super(args);

    // make sure to exclude any files with leading underscores because they
    // mean something special in Sass
    this.filePattern = '**/[^_]*.{sass,scss}';

    // we have to use a slightly different watch pattern - we care when files
    // with underscores in them change
    this.watchFilePattern = '**/*.{sass,scss}';

    // the paths to consider when resolving in Sass
    this.includePaths = includePaths;
  }

  async getOutputPath({ content, dir, name }) {
    if (isProductionEnv) {
      const hash = await getRevHash(content);
      name = `${name}.${hash}`;
    }

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
    // only load the library if we need it
    const sass = require('sass');

    // render the Sass file
    const result = sass.renderSync({ file, includePaths: this.includePaths });

    // grab the CSS result
    let css = result.css.toString();

    // if we are in production, also minify the CSS
    if (isProductionEnv) {
      css = await this.minify(css);
    }

    return css;
  }
}

module.exports = { SassEngine };

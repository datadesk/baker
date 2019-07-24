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

  get cleancss() {
    if (!this.__cleancss__) {
      const CleanCSS = require('clean-css');

      this.__cleancss__ = new CleanCSS({
        returnPromise: true,
        level: { 1: { specialComments: false }, 2: { all: true } },
      });
    }

    return this.__cleancss__;
  }

  get postcss() {
    if (!this.__postcss__) {
      const autoprefixer = require('autoprefixer');
      const postcss = require('postcss');
      const postcssFlexbugsFixes = require('postcss-flexbugs-fixes');

      this.__postcss__ = postcss([
        postcssFlexbugsFixes,
        autoprefixer({ flexbox: 'no-2009' }),
      ]);
    }

    return this.__postcss__;
  }

  async getOutputPath({ content, dir, name }) {
    if (isProductionEnv) {
      const hash = await getRevHash(content);
      name = `${name}.${hash}`;
    }

    return path.format({ dir, name, ext: '.css' });
  }

  async minify(css) {
    const { styles } = await this.cleancss.minify(css);

    return styles;
  }

  async render(file) {
    // only load the library if we need it
    const sass = require('sass');

    // render the Sass file
    const result = sass.renderSync({ file, includePaths: this.includePaths });

    // grab the CSS result
    let css = result.css.toString();

    for (const file of result.stats.includedFiles) {
      this.addDependency(file);
    }

    // if we are in production, post-process and minify the CSS
    if (isProductionEnv) {
      const { css: postProcessed } = await this.postcss.process(css, {
        from: file,
      });
      const { styles } = await this.cleancss.minify(postProcessed);

      css = styles;
    }

    return css;
  }
}

module.exports = { SassEngine };

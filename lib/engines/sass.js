// native
const path = require('path');

// local
const { BaseEngine } = require('./base');
const { isProductionEnv } = require('../env');
const { getRevHash } = require('../utils');

class SassEngine extends BaseEngine {
  constructor({ assets, includePaths, ...args }) {
    super(args);

    // make sure to exclude any files with leading underscores because they
    // mean something special in Sass
    this.filePattern = '**/[^_]*.{sass,scss}';

    // we have to use a slightly different watch pattern - we care when files
    // with underscores in them change
    this.watchFilePattern = '**/*.{sass,scss}';

    // the paths to consider when resolving in Sass
    this.includePaths = includePaths;

    // custom functions for the sass renderer
    this.functions = {};
  }

  get sass() {
    // only load the library if we need it
    if (!this.__sass__) {
      const sass = require('sass');

      this.__sass__ = sass;
    }

    return this.__sass__;
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
    const sass = this.sass;

    let result;

    // render the Sass file
    try {
      result = sass.renderSync({
        file,
        includePaths: this.includePaths,
        functions: this.functions,
      });
    } catch (err) {
      throw err;
    }

    // grab the CSS result
    let css = result.css.toString();

    for (const file of result.stats.includedFiles) {
      this.addDependency(file);
    }

    const { css: postProcessed } = await this.postcss.process(css, {
      from: file,
    });

    css = postProcessed;

    // if we are in production, post-process and minify the CSS
    if (isProductionEnv) {
      const { styles } = await this.cleancss.minify(css);

      css = styles;
    }

    return css;
  }

  addFunction(key, fn) {
    // pass in a reference to sass so incoming helpers don't have to import
    this.functions[key] = fn(this.sass);
  }
}

module.exports = { SassEngine };

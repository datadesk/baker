// native
import { format, relative } from 'path';

// packages
import autoprefixer from 'autoprefixer';
import CleanCSS from 'clean-css';
import debug from 'debug';
import postcss from 'postcss';
import postcssFlexbugsFixes from 'postcss-flexbugs-fixes';
import sass from 'sass';

// local
import { BaseEngine } from './base.js';
import { isProductionEnv } from '../env.js';
import { getRevHash } from '../utils.js';

const logger = debug('baker:engines:sass');

export class SassEngine extends BaseEngine {
  constructor({ assets, includePaths, ...args }) {
    super(args);

    this.name = 'sass';

    // make sure to exclude any files with leading underscores because they
    // mean something special in Sass
    this.filePattern = '**/[^_]*.{sass,scss}';

    // the paths to consider when resolving in Sass
    this.includePaths = includePaths;

    // custom functions for the sass renderer
    this.functions = {};
  }

  get sass() {
    // only load the library if we need it
    if (!this.__sass__) {
      this.__sass__ = sass;
    }

    return this.__sass__;
  }

  get cleancss() {
    if (!this.__cleancss__) {
      this.__cleancss__ = new CleanCSS({
        returnPromise: true,
        level: { 1: { specialComments: false }, 2: { all: true } },
      });
    }

    return this.__cleancss__;
  }

  get postcss() {
    if (!this.__postcss__) {
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

    return format({ dir, name, ext: '.css' });
  }

  async minify(css) {
    const { styles } = await this.cleancss.minify(css);

    return styles;
  }

  renderSass(file) {
    const sass = this.sass;

    return sass.renderSync({
      file,
      includePaths: this.includePaths,
      functions: this.functions,
    });
  }

  async render(file) {
    // grab the path relative to the source directory
    const input = relative(this.input, file);
    logger('rendering', input);

    // render the Sass file
    let result;

    try {
      result = this.renderSass(file);
    } catch (err) {
      throw err;
    }

    logger('finished render of', input);

    // grab the CSS result
    let css = result.css.toString();

    for (const included of result.stats.includedFiles) {
      this.addDependency(included, file);
    }

    const { css: postProcessed } = await this.postcss.process(css, {
      from: file,
    });

    css = postProcessed;

    // if we are in production, post-process and minify the CSS
    if (isProductionEnv) {
      const { styles } = await this.cleancss.minify(css);
      logger('finished minify of rendered', input);

      css = styles;
    }

    return css;
  }

  addFunction(key, fn) {
    // pass in a reference to sass so incoming helpers don't have to import
    this.functions[key] = fn(this.sass);
  }
}

// native
import path from 'path';

// packages
import debug from 'debug';

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
      const sass = import('sass'); 

      this.__sass__ = sass;
    }

    return this.__sass__;
  }

  get cleancss() {
    if (!this.__cleancss__) {
      const CleanCSS = import('clean-css');

      this.__cleancss__ = new CleanCSS({
        returnPromise: true,
        level: { 1: { specialComments: false }, 2: { all: true } },
      });
    }

    return this.__cleancss__;
  }

  get postcss() {
    if (!this.__postcss__) {
      const autoprefixer = import('autoprefixer');
      const postcss = import('postcss');
      const postcssFlexbugsFixes = import('postcss-flexbugs-fixes');

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
    // grab the path relative to the source directory
    const input = path.relative(this.input, file);
    logger('rendering', input);

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


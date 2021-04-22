// native
import { format, relative } from 'path';

// packages
import debug from 'debug';

// local
import { BaseEngine } from './base.js';
import { isProductionEnv } from '../env.js';
import { getRevHash } from '../utils.js';

const logger = debug('baker:engines:sass');

export class SassEngine extends BaseEngine {
  constructor({ assets, includePaths, postcssPlugins, ...args }) {
    super(args);

    this.name = 'sass';

    // make sure to exclude any files with leading underscores because they
    // mean something special in Sass
    this.filePattern = '**/[^_]*.{sass,scss}';

    // the paths to consider when resolving in Sass
    this.includePaths = includePaths;

    // custom functions for the sass renderer
    this.functions = {};

    // list of PostCSS plugins
    this.postCSSPlugins = [];
  }

  async loadSass() {
    // only load the library if we need it
    if (!this.__sass__) {
      this.__sass__ = await import('sass').then((module) => module.default);
      this.__functions__ = {};

      for (const [key, fn] of Object.entries(this.functions)) {
        // pass in a reference to sass so incoming helpers don't have to import
        this.__functions__[key] = fn(this.__sass__);
      }
    }

    return this.__sass__;
  }

  loadCleanCSS() {
    if (!this.__cleancss__) {
      this.__cleancss__ = import('clean-css').then(
        ({ default: CleanCSS }) =>
          new CleanCSS({
            returnPromise: true,
            level: { 1: { specialComments: false }, 2: { all: true } },
          })
      );
    }

    return this.__cleancss__;
  }

  loadPostCSS() {
    if (!this.__postcss__) {
      this.__postcss__ = Promise.all([
        import('autoprefixer'),
        import('postcss'),
        import('postcss-flexbugs-fixes'),
      ]).then(([autoprefixer, postcss, postcssFlexbugsFixes]) =>
        postcss.default([
          ...this.postCSSPlugins,
          postcssFlexbugsFixes.default,
          autoprefixer.default({ flexbox: 'no-2009' }),
        ])
      );
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

  /**
   * @param {import('postcss').Plugin} fn
   */
  addPostCSSPlugin(fn) {
    this.postCSSPlugins.push(fn);
  }

  async render(file) {
    // grab the path relative to the source directory
    const input = relative(this.input, file);
    logger('rendering', input);

    const sass = await this.loadSass();

    let result;

    // render the Sass file
    try {
      result = sass.renderSync({
        file,
        includePaths: this.includePaths,
        functions: this.__functions__,
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

    const postcss = await this.loadPostCSS();

    const { css: postProcessed } = postcss.process(css, {
      from: file,
    });

    css = postProcessed;

    const cleanCSS = await this.loadCleanCSS();

    // if we are in production, post-process and minify the CSS
    if (isProductionEnv) {
      const { styles } = await cleanCSS.minify(css);
      logger('finished minify of rendered', input);

      css = styles;
    }

    return css;
  }

  addFunction(key, fn) {
    this.functions[key] = fn;
  }
}

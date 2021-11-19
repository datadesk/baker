// native
import path from 'path';

// packages
import debug from 'debug';
import sass from 'sass';
import CleanCSS from 'clean-css';
import autoprefixer from 'autoprefixer';
import postcss from 'postcss';
import postcssFlexbugsFixes from 'postcss-flexbugs-fixes';

// local
import { BaseEngine } from './base.js';
import { isProductionEnv } from '../env.js';
import { getRevHash } from '../utils.js';

const logger = debug('baker:engines:sass');

export class SassEngine extends BaseEngine {
  constructor({ assets, includePaths, ...args }) {
    super(args);

    this.name = 'sass';

    // SCSS tools
    this.sass = sass;
    this.cleancss = new CleanCSS({
        returnPromise: true,
        level: { 1: { specialComments: false }, 2: { all: true } },
    });
    this.postcss = postcss([
        postcssFlexbugsFixes,
        autoprefixer({ flexbox: 'no-2009' }),
    ]);

    // make sure to exclude any files with leading underscores because they
    // mean something special in Sass
    this.filePattern = '**/[^_]*.{sass,scss}';

    // the paths to consider when resolving in Sass
    this.includePaths = includePaths;

    // custom functions for the sass renderer
    this.functions = {};
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

    let result;

    // render the Sass file
    try {
      result = this.sass.renderSync({
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

    const { css: postProcessed } = this.postcss.process(css, {
      from: file,
    });

    css = postProcessed;

    // if we are in production, post-process and minify the CSS
    if (isProductionEnv) {
      const { styles } = this.cleancss.minify(css);
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


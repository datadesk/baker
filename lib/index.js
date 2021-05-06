// native
import { EventEmitter } from 'events';
import { extname, join, resolve } from 'path';

// packages
import autoprefixer from 'autoprefixer';
import { watch } from 'chokidar';
import { green, yellow } from 'colorette';
import { config } from 'dotenv';
import dotenvExpand from 'dotenv-expand';
import * as journalize from 'journalize';
import debounce from 'lodash.debounce';
import postcssFlexbugsFixes from 'postcss-flexbugs-fixes';
import { premove } from 'premove';
import quaff from 'quaff';

// local
import { isProductionEnv } from './env.js';
import { clearConsole, onError, printInstructions } from './utils.js';

// tags
import { createAssetTag } from './tags/asset.js';
import { createScriptTag } from './tags/script.js';
import { createStyleTag } from './tags/style.js';

// filters
import { dateFilter } from './filters/date.js';
import { jsonScriptFilter } from './filters/json-script.js';
import { logFilter } from './filters/log.js';

// engines
import { NunjucksEngine } from './engines/nunjucks.js';
import { RollupEngine } from './engines/rollup.js';

// postcss plugins
import { staticUrlPlugin } from './postcss-plugins/static-url.js';

/**
 * @typedef {Object} BakerOptions
 * @property {Function} [createPages]
 * @property {string} data
 * @property {string} [domain]
 * @property {string} entrypoints
 * @property {string} input
 * @property {string} layouts
 * @property {import('./types').NunjucksExtensions} nunjucks
 * @property {string} output
 * @property {string} pathPrefix
 * @property {string} staticRoot
 * @property {import('svelte/types/compiler/interfaces').CompileOptions} [svelteCompilerOptions]
 */

export class Baker extends EventEmitter {
  /**
   * @param {BakerOptions} config
   */
  constructor({
    createPages,
    data,
    domain,
    entrypoints,
    input,
    layouts,
    nunjucks,
    output,
    pathPrefix,
    staticRoot,
    svelteCompilerOptions,
  }) {
    super();

    // the input directory of this baker
    this.input = resolve(input);

    // load the dotfile if it exists
    dotenvExpand(config({ path: resolve(this.input, '.env') }));

    // the likely location of the local node_modules directory
    this.nodeModules = resolve(process.cwd(), 'node_modules');

    // where we will be outputting processed files
    this.output = resolve(input, output);

    // a special directory of files that should be considered extendable
    // templates by Nunjucks
    this.layouts = resolve(input, layouts);

    // a special directory where data files for passing to templates are loaded
    this.data = resolve(input, data);

    // where in the output directory non-HTML files should go
    this.staticRoot = staticRoot;

    // the path to a file, an array of paths, or a glob for determining what's
    // considered an entrypoint for script bundles
    this.entrypoints = entrypoints;

    // a path prefix that should be applied where needed to static asset paths
    // to prep for deploy, ensures there's a leading slash
    this.pathPrefix = isProductionEnv ? resolve('/', pathPrefix) : '/';

    // the root domain for the project, which will get pulled into select
    // places for URL building
    this.domain = domain ? domain : undefined;

    // an optional function that can be provided to Baker to dynamically generate pages
    this.createPages = createPages;

    // the default input and output arguments passed to each engine
    const defaults = {
      domain: this.domain,
      input: this.input,
      output: this.output,
      pathPrefix: this.pathPrefix,
      staticRoot: this.staticRoot,
    };

    // for scripts
    this.rollup = new RollupEngine({
      entrypoints: this.entrypoints,
      svelteCompilerOptions,
      ...defaults,
    });

    // for nunjucks compiling
    this.nunjucks = new NunjucksEngine({
      layouts: this.layouts,
      createPages: this.createPages,
      ...defaults,
    });

    // add all the features of journalize to nunjucks as filters
    this.nunjucks.addCustomFilters(journalize);

    // add our custom asset tag
    const assetTag = createAssetTag(
      this.input,
      this.output,
      this.pathPrefix,
      this.staticRoot,
      this.domain
    );

    this.nunjucks.addCustomTag('asset', assetTag);

    // add custom style tag
    const styleTag = createStyleTag(
      this.input,
      this.output,
      this.pathPrefix,
      this.staticRoot,
      [
        staticUrlPlugin({ loader: assetTag }),
        postcssFlexbugsFixes,
        autoprefixer({ flexbox: 'no-2009' }),
      ]
    );

    this.nunjucks.addCustomTag('style', styleTag);

    // save a reference to our static tag function for use elsewhere
    // TODO: refactor away in v1
    // this.getStaticPath = staticTag;
    // this.nunjucks.getStaticPath = staticTag;

    // hook up our custom static tag and pass in the manifest
    this.nunjucks.addCustomTag('static', (filepath) => {
      const ext = extname(filepath);

      if (ext === '.scss' || ext === '.sass') {
        return styleTag(filepath);
      }

      return assetTag(filepath);
    });

    // save a reference to our static tag function for use elsewhere
    // TODO: refactor away in v1
    // this.getStaticAbsolutePath = staticAbsoluteTag;
    // this.nunjucks.getStaticAbsolutePath = staticAbsoluteTag;

    // hook up our custom static absolute tag and pass in the manifest
    this.nunjucks.addCustomTag('staticabsolute', (filepath) => {
      const ext = extname(filepath);

      if (ext === '.scss' || ext === '.sass') {
        return styleTag(filepath);
      }

      return assetTag(filepath, { absolute: true });
    });

    // add the "script" inject tag to nunjucks
    this.nunjucks.addCustomTag(
      'script',
      createScriptTag(this.pathPrefix, this.rollup)
    );

    // a custom date filter based on date-fns "format" function
    this.nunjucks.addCustomFilter('date', dateFilter);
    this.nunjucks.addCustomFilter('log', logFilter);
    this.nunjucks.addCustomFilter('jsonScript', jsonScriptFilter);

    // if an object of custom nunjucks filters was provided, add them now
    if (nunjucks.filters) {
      this.nunjucks.addCustomFilters(nunjucks.filters);
    }

    // if an object of custom nunjucks tags was provided, add them now
    if (nunjucks.tags) {
      this.nunjucks.addCustomTags(nunjucks.tags);
    }

    // if an object of custom nunjucks block tags was provided, add them now
    if (nunjucks.blockTags) {
      this.nunjucks.addCustomBlockTags(nunjucks.blockTags);
    }

    // add our custom postCSS plugin for resolving URLs
    // this.sass.addPostCSSPlugin(staticUrlPlugin({ loader: assetTag }));
  }

  async getData() {
    try {
      return await quaff(this.data);
    } catch (err) {
      // the directory didn't exist and that's okay
      if (err.code === 'ENOENT') {
        return {};
      }

      // otherwise we want the real error
      throw err;
    }
  }

  async serve() {
    // remove the output directory to make sure it's clean
    await premove(this.output);

    // we only load mini-sync if it is being used
    const { create } = await import('mini-sync');

    // prep the server instance
    const server = create({
      dir: [this.output, this.input],
      port: 3000,
    });

    this.nunjucks.postprocess = function postprocess(html) {
      return html.replace(
        '</head>',
        '<script async src="/__mini_sync__/client.js"></script>\n</head>'
      );
    };

    // track the errors
    let templatesError = null;
    let scriptsError = null;
    let dataError = null;

    clearConsole();
    console.log(yellow('Starting initial serve...'));

    let data;

    try {
      data = await this.getData();
    } catch (err) {
      dataError = err;
    }

    try {
      this.rollup.context = data;
      await this.rollup.build();
    } catch (err) {
      scriptsError = err;
    }

    try {
      this.nunjucks.context = data;
      await this.nunjucks.build();
    } catch (err) {
      templatesError = err;
    }

    const { local, network: external } = await server.start();

    const logStatus = () => {
      clearConsole();

      let hadError = false;

      if (templatesError) {
        hadError = true;
        onError('Templates', templatesError);
      }

      if (scriptsError) {
        hadError = true;
        onError('Scripts', scriptsError);
      }

      if (dataError) {
        hadError = true;
        onError('Data', dataError);
      }

      if (!hadError) {
        console.log(green('Project compiled successfully!'));
        printInstructions({ external, local });
      }
    };

    // our initial status log
    logStatus();

    this.rollup.watch((err) => {
      if (err) {
        scriptsError = err;
      } else {
        scriptsError = null;

        server.reload();
      }

      logStatus();
    });

    this.nunjucks.watch((err) => {
      if (err) {
        templatesError = err;
      } else {
        templatesError = null;

        server.reload();
      }

      logStatus();
    });

    const dataWatcher = watch(join(this.data, '**/*'), {
      ignoreInitial: true,
    });

    const onChange = debounce(async () => {
      let data;

      dataError = null;
      scriptsError = null;
      templatesError = null;

      try {
        data = await this.getData();
      } catch (err) {
        dataError = err;
      }

      this.rollup.context = data;
      this.nunjucks.context = data;

      try {
        this.rollup.context = data;
        await this.rollup.build();
      } catch (err) {
        scriptsError = err;
      }

      try {
        this.nunjucks.context = data;
        await this.nunjucks.build();
      } catch (err) {
        templatesError = err;
      }

      if (!dataError && !scriptsError && !templatesError) {
        server.reload();
      }

      logStatus();
    }, 200);

    ['add', 'change', 'unlink'].forEach((event) => {
      dataWatcher.on(event, onChange);
    });
  }
}

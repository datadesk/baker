// native
const { EventEmitter } = require('events');
const { join, resolve } = require('path');

// packages
const chokidar = require('chokidar');
const { green, yellow } = require('colorette');
const { format, isDate, parseISO } = require('date-fns');
const debounce = require('lodash.debounce');
const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');
const journalize = require('journalize');
const quaff = require('quaff');

// local
const { isProductionEnv } = require('./env');
const { clearConsole, onError, printInstructions } = require('./utils');
const {
  createInjectBlock,
  createScriptBlock,
  createStaticBlock,
  createStaticAbsoluteBlock,
} = require('./blocks');

// vendor
const { rimraf } = require('./vendor/rimraf');

// engines
const { AssetsEngine } = require('./engines/assets');
const { NunjucksEngine } = require('./engines/nunjucks');
const { RollupEngine } = require('./engines/rollup');
const { SassEngine } = require('./engines/sass');

class Baker extends EventEmitter {
  constructor({
    assets,
    createPages,
    data,
    domain,
    entrypoints,
    input,
    layouts,
    output,
    pathPrefix,
    staticRoot,
  }) {
    super();

    // the input directory of this baker
    this.input = resolve(input);

    // load the dotfile if it exists
    dotenvExpand(dotenv.config({ path: resolve(this.input, '.env') }));

    // the likely location of the local node_modules directory
    this.nodeModules = resolve(process.cwd(), 'node_modules');

    // where we will be outputting processed files
    this.output = resolve(input, output);

    // a special directory of files that should be considered extendable
    // templates by Nunjucks
    this.layouts = resolve(input, layouts);

    // a special directory where data files for passing to templates are loaded
    this.data = resolve(input, data);

    // a special directory where asset files live
    this.assets = resolve(input, assets);

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

    this.assets = new AssetsEngine({
      dir: this.assets,
      ...defaults,
    });

    // for sass compiling
    this.sass = new SassEngine({
      includePaths: [this.nodeModules],
      assets: this.assets,
      ...defaults,
    });

    // for scripts
    this.rollup = new RollupEngine({
      entrypoints: this.entrypoints,
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

    // add our custom inject tag
    const injectBlock = createInjectBlock(this.input, this.output, [
      this.assets,
      this.sass,
    ]);

    this.nunjucks.addCustomTag('inject', injectBlock);

    // create our static tag
    const staticBlock = createStaticBlock(this.input, this.pathPrefix, [
      this.assets,
      this.sass,
    ]);

    // save a reference to our static block function for use elsewhere
    this.getStaticPath = staticBlock;

    // hook up our custom static tag and pass in the manifest
    this.nunjucks.addCustomTag('static', staticBlock);

    const staticAbsoluteBlock = createStaticAbsoluteBlock(
      this.input,
      this.domain,
      this.pathPrefix,
      [this.assets, this.sass]
    );

    // save a reference to our static block function for use elsewhere
    this.getStaticAbsolutePath = staticAbsoluteBlock;

    // hook up our custom static absolute tag and pass in the manifest
    this.nunjucks.addCustomTag('staticabsolute', staticAbsoluteBlock);

    // add the "script" inject tag to nunjucks
    this.nunjucks.addCustomTag(
      'script',
      createScriptBlock(this.pathPrefix, this.rollup)
    );

    // a custom date filter based on date-fns "format" function
    this.nunjucks.addCustomFilter('date', (value, formatString) => {
      if (!formatString) {
        throw new Error('A "formatString" must be passed to the date filter');
      }

      // we want to be able to accept both ISO date strings and Date objects,
      // so we check for that and convert if needed
      if (!isDate(value)) {
        value = parseISO(value);
      }

      // TODO: should we check with isDate again just in case parseISO
      // returned an invalid date?

      return format(value, formatString);
    });

    // hook up our custom sass functions
    this.sass.addFunction('static-path($file)', (sass) => ($file) =>
      new sass.types.String(staticBlock($file.getValue()))
    );

    this.sass.addFunction('static-url($file)', (sass) => ($file) =>
      new sass.types.String(`url(${staticBlock($file.getValue())})`)
    );
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
    await rimraf(this.output);

    // we only load mini-sync if it is being used
    const { create } = require('mini-sync');

    // prep the server instance
    const server = create({
      dir: [this.output, this.input],
      port: 3000,
    });

    // track the errors
    let templatesError = null;
    let stylesError = null;
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

    // we need an initial run to populate the manifest
    try {
      await this.sass.build();
    } catch (err) {
      stylesError = err;
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

      if (stylesError) {
        hadError = true;
        onError('Styles', stylesError);
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

    // set up the watcher
    this.sass.watch((err) => {
      if (err) {
        stylesError = err;
      } else {
        stylesError = null;

        for (const file of Object.values(this.sass.manifest)) {
          server.reload(resolve(this.pathPrefix, file));
        }
      }

      logStatus();
    });

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

    const dataWatcher = chokidar.watch(join(this.data, '**/*'), {
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

  async bake() {
    // emit event that a bake has begun
    this.emit('bake:start');

    // remove the output directory to make sure it's clean
    await rimraf(this.output);

    // prep the data
    const data = await this.getData();

    // pass the data context to rollup and nunjucks
    this.rollup.context = data;
    this.nunjucks.context = data;

    // wait for all the assets to prepare first
    await this.assets.build();

    // compile the rest of the assets
    await Promise.all([this.sass.build(), this.rollup.build()]);

    // build the HTML
    await this.nunjucks.build();

    // emit event that a bake has completed
    this.emit('bake:end');
  }
}

module.exports = { Baker };

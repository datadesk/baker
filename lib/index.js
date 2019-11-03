// native
const EventEmitter = require('events');
const { join, resolve } = require('path');

// packages
const chokidar = require('chokidar');
const colors = require('ansi-colors');
const debounce = require('lodash.debounce');
const dotenv = require('dotenv');
const fs = require('fs-extra');
const journalize = require('journalize');
const quaff = require('quaff');

// local
const { clearConsole, onError, printInstructions } = require('./utils');
const { createScriptBlock, createStaticBlock, inject } = require('./blocks');

// engines
const { AssetsEngine } = require('./engines/assets');
const { NunjucksEngine } = require('./engines/nunjucks');
const { RollupEngine } = require('./engines/rollup');
const { SassEngine } = require('./engines/sass');

class Baker extends EventEmitter {
  constructor({
    assets,
    data,
    entrypoints,
    input,
    layouts,
    output,
    pathPrefix,
  }) {
    super();

    // the input directory of this baker
    this.input = resolve(input);

    // load the dotfile if it exists
    dotenv.config({ path: resolve(this.input, '.env') });

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

    // the path to a file, an array of paths, or a glob for determining what's
    // considered an entrypoint for script bundles
    this.entrypoints = entrypoints;

    // a path prefix that should be applied where needed to static asset paths
    // to prep for deploy, ensures there's a leading slash
    this.pathPrefix = resolve('/', pathPrefix);

    // the default input and output arguments passed to each engine
    const defaults = { input: this.input, output: this.output, pathPrefix };

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
      ...defaults,
    });

    // add all the features of journalize to nunjucks as filters
    this.nunjucks.addCustomFilters(journalize);

    // add our custom inject tag
    this.nunjucks.addCustomTag('inject', inject);

    const staticBlock = createStaticBlock(this.input, this.pathPrefix, [
      this.assets,
      this.sass,
    ]);

    // hook up our custom static tag and pass in the manifest
    this.nunjucks.addCustomTag('static', staticBlock);

    this.nunjucks.addCustomTag(
      'script',
      createScriptBlock(this.pathPrefix, this.rollup)
    );

    // hook up our custom sass functions
    this.sass.addFunction('static-path($file)', sass => $file =>
      new sass.types.String(staticBlock($file.getValue()))
    );

    this.sass.addFunction('static-url($file)', sass => $file =>
      new sass.types.String(`url(${staticBlock($file.getValue())})`)
    );
  }

  async getData() {
    try {
      return await quaff(this.data);
    } catch (err) {
      return {};
    }
  }

  async serve() {
    // remove the output directory to make sure it's clean
    await fs.remove(this.output);

    // we only load mini-sync if it is being used
    const { create } = require('mini-sync');

    const server = await create({
      dir: [this.output, this.input],
      port: 3000,
    });

    // track the errors
    let templatesError = null;
    let stylesError = null;
    let scriptsError = null;

    clearConsole();
    console.log(colors.yellow('Starting initial serve...'));

    const local = server.local;
    const external = server.network;

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

      if (!hadError) {
        console.log(colors.green('Project compiled successfully!'));
        printInstructions({ external, local });
      }
    };

    // we need an initial run to populate the manifest
    try {
      await this.sass.build();
    } catch (err) {
      stylesError = err;
    }

    try {
      await this.rollup.build();
    } catch (err) {
      scriptsError = err;
    }

    try {
      this.nunjucks.context = await this.getData();
      await this.nunjucks.build();
    } catch (err) {
      templatesError = err;
    }

    logStatus();

    // set up the watcher
    this.sass.watch(err => {
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

    this.rollup.watch(err => {
      if (err) {
        scriptsError = err;
      } else {
        scriptsError = null;

        server.reload();
      }

      logStatus();
    });

    this.nunjucks.watch(err => {
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
      try {
        this.nunjucks.context = await this.getData();
        await this.nunjucks.build();

        server.reload();
      } catch (err) {
        templatesError = err;
      }

      logStatus();
    }, 200);

    ['add', 'change', 'unlink'].forEach(event => {
      dataWatcher.on(event, onChange);
    });
  }

  async bake() {
    // emit event that a bake has begun
    this.emit('bake:start');

    // remove the output directory to make sure it's clean
    await fs.remove(this.output);

    // prepare the data context from the data directory
    this.nunjucks.context = await this.getData();

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

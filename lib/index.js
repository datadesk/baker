// native
const EventEmitter = require('events');
const { resolve } = require('path');

// packages
const colors = require('ansi-colors');
const fs = require('fs-extra');
const journalize = require('journalize');
const quaff = require('quaff');

// local
const { createScriptBlock, createStaticBlock, inject } = require('./blocks');
const { clearConsole, onError, printInstructions } = require('./utils');
const { ImagesEngine } = require('./engines/images');
const { NunjucksEngine } = require('./engines/nunjucks');
const { RollupEngine } = require('./engines/rollup');
const { SassEngine } = require('./engines/sass');

class Baker extends EventEmitter {
  constructor({ entrypoints, input, output, layouts, data, pathPrefix }) {
    super();

    // the input directory of this baker
    this.input = resolve(input);

    // the likely location of the local node_modules directory
    this.nodeModules = resolve(process.cwd(), 'node_modules');

    // where we will be outputting processed files
    this.output = resolve(input, output);

    // a special directory of files that should be considered extendable
    // templates by Nunjucks
    this.layouts = resolve(input, layouts);

    // a special directory where data files for passing to templates are loaded
    this.data = resolve(input, data);

    // the path to a file, an array of paths, or a glob for determining what's
    // considered an entrypoint for script bundles
    this.entrypoints = entrypoints;

    // a path prefix that should be applied where needed to static asset paths
    // to prep for deploy, ensures there's a leading slash
    this.pathPrefix = resolve('/', pathPrefix);

    // the default input and output arguments passed to each engine
    const defaults = { input: this.input, output: this.output, pathPrefix };

    // for sass compiling
    this.sass = new SassEngine({
      includePaths: [this.nodeModules],
      ...defaults,
    });

    // for scripts
    this.rollup = new RollupEngine({
      entrypoints: this.entrypoints,
      ...defaults,
    });

    // for images
    this.images = new ImagesEngine(defaults);

    // for nunjucks compiling
    this.nunjucks = new NunjucksEngine({
      layouts: this.layouts,
      ...defaults,
    });

    // add all the features of journalize to nunjucks as filters
    this.nunjucks.addCustomFilters(journalize);

    // add our custom inject tag
    this.nunjucks.addCustomTag('inject', inject);

    // hook up our custom static tag and pass in the manifest
    this.nunjucks.addCustomTag(
      'static',
      createStaticBlock(this.pathPrefix, [this.sass, this.images])
    );

    this.nunjucks.addCustomTag(
      'script',
      createScriptBlock(this.pathPrefix, this.rollup)
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

    // we only load browser-sync if it is being used
    const browserSync = require('browser-sync');

    const server = browserSync.create();

    server.init(
      {
        logLevel: 'silent',
        logPrefix: 'baker',
        notify: false,
        open: false,
        port: 3000,
        server: {
          baseDir: [this.output, this.input],
        },
      },
      async err => {
        if (err) return console.error(err);

        // track the errors
        let templatesError = null;
        let stylesError = null;
        let scriptsError = null;

        clearConsole();
        console.log(colors.yellow('Starting initial serve...'));

        const urls = server.getOption('urls');

        const local = urls.get('local');
        const external = urls.get('external');

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

            if (server.active) {
              for (const file of Object.values(this.sass.manifest)) {
                server.reload(resolve(this.pathPrefix, file));
              }
            }
          }

          logStatus();
        });

        this.rollup.watch(err => {
          if (err) {
            scriptsError = err;
          } else {
            scriptsError = null;

            if (server.active) {
              server.reload();
            }
          }

          logStatus();
        });

        this.nunjucks.watch(err => {
          if (err) {
            templatesError = err;
          } else {
            templatesError = null;

            if (server.active) {
              server.reload();
            }
          }

          logStatus();
        });
      }
    );
  }

  async bake() {
    // emit event that a bake has begun
    this.emit('bake:start');

    // remove the output directory to make sure it's clean
    await fs.remove(this.output);

    // prepare the data context from the data directory
    this.nunjucks.context = await this.getData();

    // wait for all the assets to prepare first
    await Promise.all([
      this.sass.build(),
      this.rollup.build(),
      this.images.build(),
    ]);

    // build the HTML
    await this.nunjucks.build();

    // emit event that a bake has completed
    this.emit('bake:end');
  }
}

module.exports = { Baker };

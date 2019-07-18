// native
const path = require('path');

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

class Bakery {
  constructor({ assets, input, output, layouts, data, pathPrefix }) {
    // the input directory of this bakery
    this.input = path.resolve(input);

    // the likely location of the local node_modules directory
    this.nodeModules = path.resolve(process.cwd(), 'node_modules');

    // where we will be outputting processed files
    this.output = path.resolve(input, output);

    // a special directory of files that should be considered extendable templates by Nunjucks
    this.layouts = path.resolve(input, layouts);

    // a special directory where data files for passing to templates are loaded
    this.data = path.resolve(input, data);

    // a special directory where files are passed through without being touched
    this.assets = path.resolve(input, assets);

    // a path prefix that should be applied where needed to static asset paths to prep for deploy
    this.pathPrefix = pathPrefix;

    // the default input and output arguments passed to each engine
    const defaults = { input: this.input, output: this.output };

    // for nunjucks compiling
    this.nunjucks = new NunjucksEngine({
      searchPaths: [this.layouts, this.input],
      ...defaults,
    });

    // add all the features of journalize to nunjucks as filters
    this.nunjucks.addCustomFilters(journalize);

    // add our custom inject tag
    this.nunjucks.addCustomTag('inject', inject);

    // for sass compiling
    this.sass = new SassEngine({
      includePaths: [this.nodeModules],
      ...defaults,
    });

    this.rollup = new RollupEngine(defaults);

    this.images = new ImagesEngine(defaults);

    this.engines = [this.nunjucks, this.sass, this.rollup, this.images];
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
        logPrefix: 'bakery',
        notify: false,
        open: false,
        port: 3000,
        server: {
          baseDir: [this.output, this.assets],
        },
      },
      async err => {
        if (err) return console.error(err);

        // track the errors
        let templatesError = null;
        let stylesError = null;
        let scriptsError = null;

        console.log(colors.yellow('Starting initial serve...'));

        const urls = server.getOption('urls');

        const local = urls.get('local');
        const external = urls.get('external');

        const manifest = {};

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
            printInstructions({ local, external });
          }
        };

        clearConsole();
        printInstructions({ external, local });

        // we need an initial run to populate the manifest
        manifest.static = await this.sass.build();

        // set up the watcher
        this.sass.watch((err, css) => {
          if (err) {
            stylesError = err;
          } else {
            stylesError = null;
            manifest.static = css;

            if (server.active) {
              for (const file of Object.values(css)) {
                server.reload(file);
              }
            }
          }

          logStatus();
        });

        // initial run to populate manifest
        manifest.scripts = await this.rollup.build();

        this.rollup.watch((err, scripts) => {
          if (err) {
            scriptsError = err;
          } else {
            scriptsError = null;
            manifest.scripts = scripts;

            if (server.active) {
              server.reload();
            }
          }

          logStatus();
        });

        this.nunjucks.addCustomTag(
          'script',
          createScriptBlock(this.pathPrefix, manifest)
        );

        // hook up our custom static tag
        this.nunjucks.addCustomTag(
          'static',
          createStaticBlock(this.pathPrefix, manifest)
        );

        this.nunjucks.watch((err, update) => {
          if (err) {
            templatesError = err;
          } else {
            templatesError = null;
            manifest.html = update;

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
    // remove the output directory to make sure it's clean
    await fs.remove(this.output);

    // prepare the data context from the data directory
    const data = await this.getData();

    const [stylesManifest, scriptManifest, imagesManifest] = await Promise.all([
      this.sass.build(),
      this.rollup.build(),
      this.images.build(),
    ]);

    // hook up our custom static tag and pass in the manifest
    this.nunjucks.addCustomTag(
      'static',
      createStaticBlock(this.pathPrefix, {
        static: { ...stylesManifest, ...imagesManifest },
      })
    );

    this.nunjucks.addCustomTag(
      'script',
      createScriptBlock(this.pathPrefix, { scripts: scriptManifest })
    );

    await this.nunjucks.build(data);
  }
}

module.exports = { Bakery };

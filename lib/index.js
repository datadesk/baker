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
  constructor({ input, output, layouts, data, pathPrefix }) {
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

    // we only load browser-sync and glob-watcher if they are being used
    const browserSync = require('browser-sync');
    // const watch = require('glob-watcher');

    const server = browserSync.create();

    server.init(
      {
        logLevel: 'silent',
        logPrefix: 'bakery',
        notify: false,
        open: false,
        port: 3000,
        server: {
          baseDir: this.output,
        },
      },
      async err => {
        if (err) return console.error(err);

        // track the errors
        let templatesError = null;
        let stylesError = null;

        console.log(colors.yellow('Starting initial serve...'));

        const urls = server.getOption('urls');

        const local = urls.get('local');
        const external = urls.get('external');

        const manifest = {};

        this.nunjucks.addCustomTag(
          'script',
          createScriptBlock(this.pathPrefix, manifest)
        );

        const logStatus = () => {
          // clearConsole();

          let hadError = false;

          if (templatesError) {
            hadError = true;
            onError('Templates', templatesError);
          }

          if (stylesError) {
            hadError = true;
            onError('Styles', stylesError);
          }

          if (!hadError) {
            console.log(colors.green('Project compiled successfully!'));
            printInstructions({ local, external });
          }
        };

        clearConsole();
        printInstructions({ external, local });

        // hook up our custom static tag
        this.nunjucks.addCustomTag(
          'static',
          createStaticBlock(this.pathPrefix, manifest)
        );

        await this.rollup.watch(update => {
          manifest.scripts = update;
        });

        this.sass.watch(async () => {
          try {
            const update = await this.sass.build();
            manifest.static = update;

            if (server.active) {
              for (const file of Object.values(update)) {
                server.reload(file);
              }
            }

            stylesError = null;
          } catch (err) {
            stylesError = err;
          }

          logStatus();
        });

        this.nunjucks.watch(async () => {
          // prepare the data context from the data directory
          const data = await this.getData();

          try {
            await this.nunjucks.build(data);

            if (server.active) {
              server.reload();
            }

            templatesError = null;
          } catch (err) {
            templatesError = err;
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

    // we use the output of the Sass build to hook things up correctly in the HTML
    const stylesManifest = await this.sass.build();

    // the rollup build for JavaScript
    const scriptManifest = await this.rollup.build();

    // build for images
    const imagesManifest = await this.images.build();

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

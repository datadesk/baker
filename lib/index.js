// native
const path = require('path');

// packages
const colors = require('ansi-colors');
const fs = require('fs-extra');
const journalize = require('journalize');
const quaff = require('quaff');

// local
const { createStaticBlock } = require('./blocks');
const { clearConsole, onError, printInstructions } = require('./utils');
const { NunjucksEngine } = require('./engines/nunjucks');
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

    // for sass compiling
    this.sass = new SassEngine({ includePaths: [this.nodeModules], defaults });
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
    // we only load browser-sync and chokidar if they are being used
    const browserSync = require('browser-sync');
    const watch = require('glob-watcher');

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
          createStaticBlock(this.pathPrefix)
        );

        watch(
          await this.sass.findFiles(),
          { ignoreInitial: false },
          async () => {
            try {
              const manifest = await this.sass.build();

              if (server.active) {
                for (const file of Object.keys(manifest)) {
                  server.reload(file);
                }
              }

              stylesError = null;
            } catch (err) {
              stylesError = err;
            }

            logStatus();
          }
        );

        watch(
          await this.nunjucks.findFiles({
            ignore: [path.join(this.output, '**'), '**/node_modules/**'],
          }),
          { ignoreInitial: false },
          async () => {
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
          }
        );
      }
    );
  }

  async bake() {
    // remove the output directory to make sure it's clean
    await fs.remove(this.output);

    // prepare the data context from the data directory
    const data = await this.getData();

    // we use the output of the Sass build to hook things up correctly in the HTML
    const manifest = await this.sass.build();

    // hook up our custom static tag and pass in the manifest
    this.nunjucks.addCustomTag(
      'static',
      createStaticBlock(this.pathPrefix, manifest)
    );

    await this.nunjucks.build(data);
  }
}

module.exports = { Bakery };

// native
const path = require('path');

// packages
const colors = require('ansi-colors');
const fs = require('fs-extra');
const journalize = require('journalize');
const quaff = require('quaff');

// local
const { createStaticBlock } = require('./blocks');
const { clearConsole, printInstructions } = require('./utils');
const { NunjucksEngine } = require('./engines/nunjucks');
const { SassEngine } = require('./engines/sass');

class Bakery {
  constructor({ input, output, layouts, data, pathPrefix }) {
    // the input directory of this bakery
    this.input = path.resolve(input);

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
    this.sass = new SassEngine(defaults);
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

        console.log(colors.yellow('Starting initial serve...'));

        const urls = server.getOption('urls');

        const local = urls.get('local');
        const external = urls.get('external');

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
            const manifest = await this.sass.build();

            if (server.active) {
              for (const file of Object.keys(manifest)) {
                server.reload(file);
              }
            }
          }
        );

        watch(
          await this.nunjucks.findFiles({ ignore: '**/_*' }),
          { ignoreInitial: false },
          async () => {
            // prepare the data context from the data directory
            const data = await quaff(this.data);

            await this.nunjucks.build(data);

            if (server.active) {
              server.reload();
            }
          }
        );
      }
    );
  }

  async bake() {
    // remove the output directory to make sure it's clean
    await fs.remove(this.output);

    // prepare the data context from the data directory
    const data = await quaff(this.data);

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

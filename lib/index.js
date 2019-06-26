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

    this.nunjucks.addCustomFilters(journalize);

    // for sass compiling
    this.sass = new SassEngine(defaults);
  }

  async serve() {
    // remove the output directory to make sure it's clean
    await fs.remove(this.output);
    // we only load browser-sync and glob-watcher if they are being used
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

        const compileTemplates = async () => {
          // prepare the data from the data directory
          const data = await quaff(this.data);

          await this.nunjucks.publish({ data });

          // if browsersync is running, reload it
          if (server.active) {
            server.reload();
          }
        };

        const compileStyles = async () => {
          const report = await this.sass.publish();

          if (server.active) {
            report.forEach(({ relativeOutputPath }) =>
              server.reload(relativeOutputPath)
            );
          }
        };

        await compileTemplates();
        await compileStyles();

        watch(
          [path.join(this.input, '**/*.{njk,html}'), `!${this.output}/**/*`],
          compileTemplates
        );
        watch(
          [path.join(this.input, '**/*.scss'), `!${this.output}`],
          compileStyles
        );
      }
    );
  }

  async bake() {
    // remove the output directory to make sure it's clean
    await fs.remove(this.output);

    // prepare the data from the data directory
    const data = await quaff(this.data);

    const manifest = await this.sass.build();

    // hook up our custom tag and add our manifest
    this.nunjucks.addCustomTag(
      'static',
      createStaticBlock(this.pathPrefix, manifest)
    );

    await this.nunjucks.build({ data });
  }
}

module.exports = { Bakery };

// native
const path = require('path');

// packages
const colors = require('ansi-colors');
const fs = require('fs-extra');
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

    this.ignore = [this.output, this.layouts, this.data];

    // for nunjucks compiling
    this.nunjucks = new NunjucksEngine({
      ignore: this.ignore,
      input: this.input,
      output: this.output,
      searchPaths: [this.layouts, this.input],
    });

    // our custom tags
    this.nunjucks.addCustomTag('static', createStaticBlock(this.pathPrefix));

    // for sass compiling
    this.sass = new SassEngine({
      ignore: this.ignore,
      input: this.input,
      output: this.output,
    });
  }

  serve() {
    // we only load browser-sync and glob-watcher if they are being used
    const browserSync = require('browser-sync');
    const watch = require('glob-watcher');

    const env = 'development';

    // for rendering our Sass
    const sass = new SassEngine({ env });

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

        const compileStyles = async () => {
          const report = await this.sass.publish();

          if (server.active) {
            report.forEach(({ relativeOutputPath }) =>
              server.reload(relativeOutputPath)
            );
          }
        };

        await compileStyles();

        watch(path.join(this.input, '**/*.scss'), compileStyles);
      }
    );
  }

  async bake() {
    // remove the output directory to make sure it's clean
    await fs.remove(this.output);

    // prepare the data from the data directory
    const data = await quaff(this.data);

    // run the publishes
    await this.nunjucks.publish({ data });
    await this.sass.publish();
  }
}

module.exports = { Bakery };

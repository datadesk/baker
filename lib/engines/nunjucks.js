// native
const path = require('path');

// packages
const fs = require('fs-extra');
const glob = require('fast-glob');
const {
  Environment,
  FileSystemLoader,
  NodeResolveLoader,
  runtime,
  Template,
} = require('nunjucks');

class NunjucksEngine {
  constructor({ ignore, input, output, searchPaths }) {
    // the input directory
    this.input = input;

    // the output directory
    this.output = output;

    // ignore directories
    this.ignore = ignore;

    // the extensions this engine uses
    this.extensions = ['.njk', '.html'];

    // handles loading template files from the file system
    const fileLoader = new FileSystemLoader(searchPaths);

    // handles loading template files from node_modules
    const nodeLoader = new NodeResolveLoader();

    // the prepared nunjucks environemnt
    this.env = new Environment([fileLoader, nodeLoader], {
      autoescape: false,
      noCache: true,
      trimBlocks: true,
    });
  }

  async compile(filepath) {
    // read the raw string
    const raw = await fs.readFile(filepath, 'utf8');

    // create the template
    const template = new Template(raw, this.env, path.resolve(filepath));

    return function render(context) {
      return new Promise((resolve, reject) => {
        template.render(context, (err, text) => {
          if (err) reject(err);

          resolve(text);
        });
      });
    };
  }

  async render(filepath, context) {
    const render = await this.compile(filepath);

    return render(context);
  }

  async publish({ data }) {
    const files = await glob(path.join(this.input, '**/*.{html,njk}'), {
      ignore: this.ignore,
    });

    const report = [];

    for (let idx = 0; idx < files.length; idx++) {
      // get the file
      const file = files[idx];

      // grab the path relative to the source directory
      const relativePath = path.relative(this.input, file);

      // pull the relative path's extension and name
      const { base, ext, name } = path.parse(relativePath);

      // we always use "pretty" URLs, so we alter the pathname if it is index.html
      const pathname =
        name === 'index'
          ? relativePath.replace(base, '')
          : relativePath.replace(ext, '');

      const relativeOutputPath = path.join(pathname, 'index.html');

      // build the output path
      const outputPath = path.join(this.output, relativeOutputPath);

      const html = await this.render(file, data);

      await fs.outputFile(outputPath, html);

      report.push({ file, relativePath, relativeOutputPath, outputPath });
    }

    return report;
  }

  addCustomFilter(name, fn, async) {
    this.env.addFilter(name, fn, async);
  }

  addCustomTag(name, fn) {
    class CustomTag {
      constructor() {
        this.tags = [name];
      }

      parse(parser, nodes) {
        // get the tag token
        const token = parser.nextToken();

        // parse the supplied args
        const args = parser.parseSignature(true, true);

        // advance to the end of the block
        parser.advanceAfterBlockEnd(token.value);

        // pass things along to run()
        return new nodes.CallExtension(this, 'run', args);
      }

      run(_, ...args) {
        return new runtime.SafeString(fn(...args));
      }
    }

    this.env.addExtension(name, new CustomTag());
  }

  /**
   * A static version of the render function that skips using the Nunjucks
   * environment. This is useful for files that may be getting templated but
   * shouldn't be able to use inheritance, like Sass files.
   *
   * @param {string} filepath The path to the file to render
   * @param {*} context An object to be provided as context to the template
   */
  static async renderOnly(filepath, context) {
    // read the raw string
    const raw = await fs.readFile(filepath, 'utf8');

    // create the template
    const template = new Template(raw, path.resolve(filepath));

    // resolve the render
    return new Promise((resolve, reject) => {
      template.render(context, (err, text) => {
        if (err) reject(err);

        resolve(text);
      });
    });
  }
}

module.exports = { NunjucksEngine };

// native
const path = require('path');

// packages
const fs = require('fs-extra');
const { codeFrameColumns } = require('@babel/code-frame');
const {
  Environment,
  FileSystemLoader,
  NodeResolveLoader,
  runtime,
  Template,
} = require('nunjucks');

// local
const { BaseEngine } = require('./base');
const { isProductionEnv, nodeEnv } = require('../env');

class NunjucksEngine extends BaseEngine {
  constructor({ layouts, ...args }) {
    super(args);

    // the directory where Nunjucks templates and includes can be found
    this.layouts = layouts;

    // the glob pattern to use for finding files to process
    this.filePattern = '**/*.{html,njk}';

    // any files or paths to ignore when searching
    this.ignorePattern = [this.layouts, ...this.ignorePattern];

    // the staticRoot should always be an empty string for HTML
    this.staticRoot = '';

    // TODO: How to make the _layout directory be watched, it gets ignored by the default ignorePattern (underscores)

    // an optional separate watch pattern for ignoring during watching
    this.watchIgnorePattern = [
      path.join(this.output, '**'),
      '**/node_modules/**',
    ];

    // handles loading template files from the file system
    const fileLoader = new FileSystemLoader([this.layouts, this.input], {
      noCache: true,
    });

    // handles loading template files from node_modules
    const nodeLoader = new NodeResolveLoader({ noCache: true });

    // the prepared nunjucks environemnt
    this.env = new Environment([fileLoader, nodeLoader], {
      autoescape: false,
      dev: true,
      throwOnUndefined: true,
      trimBlocks: true,
    });

    // add global reference to the current Node environment
    this.env.addGlobal('NODE_ENV', nodeEnv);

    // add global reference to the domain
    this.env.addGlobal('DOMAIN', this.domain);

    // add global reference to the current path prefix
    this.env.addGlobal('PATH_PREFIX', this.pathPrefix);

    this.env.on('load', (_, { path }) => {
      this.addDependency(path);
    });

    this.context = {};
  }

  getOutputPath({ base, ext, input, name }) {
    // we always use "pretty" URLs, so we alter the pathname if it is index.html
    const pathname =
      name === 'index' ? input.replace(base, '') : input.replace(ext, '');

    return path.join(pathname, 'index.html');
  }

  async compile(file) {
    // read the raw string
    const raw = await fs.readFile(file, 'utf8');

    // create the template
    const template = new Template(raw, this.env, path.resolve(file));

    return function render(context) {
      return new Promise((resolve, reject) => {
        template.render(context, (err, text) => {
          if (err) {
            if (err.lineno && err.colno) {
              err.frame = codeFrameColumns(raw, {
                start: { line: err.lineno, column: err.colno },
              });
            }

            reject(err);
          }

          resolve(text);
        });
      });
    };
  }

  get minifier() {
    // this is a big import, so only load it if necessary
    if (!this.__minifier__) {
      const { minify } = require('html-minifier');
      this.__minifier__ = minify;
    }

    return this.__minifier__;
  }

  async render(file) {
    // grab the path relative to the source directory
    const input = path.relative(this.input, file);

    // pull the relative path's directory and name
    const { dir, name } = path.parse(input);

    // pivot on whether this is an index file or not
    const pathname = name === 'index' ? '/' : `${name}/`;

    // build the complete URL
    const currentUrl = new URL(
      path.join(this.pathPrefix, dir, pathname),
      this.domain
    );

    // prepare the current URL to be passed to context
    const absolute_url = currentUrl.toString();

    // prep the current_page tracking object
    const current_page = { absolute_url };

    // compile the Nunjucks template
    const render = await this.compile(file);

    // mark this file as a dependency
    this.addDependency(file);

    let results = await render({ current_page, ...this.context });

    if (isProductionEnv) {
      results = this.minifier(results, { collapseWhitespace: true });
    }

    return results;
  }

  addCustomGlobal(name, value) {
    this.env.addGlobal(name, value);
  }

  addCustomFilter(name, fn) {
    this.env.addFilter(name, fn);
  }

  addCustomFilters(obj) {
    for (const [name, fn] of Object.entries(obj)) {
      this.addCustomFilter(name, fn);
    }
  }

  addCustomTag(name, fn) {
    const isAsync = fn.async;

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

        const CallExtension = isAsync
          ? nodes.CallExtensionAsync
          : nodes.CallExtension;

        // pass things along to run()
        return new CallExtension(this, 'run', args);
      }

      run(_, ...args) {
        if (isAsync) {
          const callback = args.pop();

          fn(...args, (err, value) => {
            if (err) callback(err);

            callback(null, new runtime.SafeString(value));
          });
        } else {
          // pass the function through to nunjucks with the parameters
          return new runtime.SafeString(fn(...args));
        }
      }
    }

    this.env.addExtension(name, new CustomTag());
  }

  addCustomBlockTag(name, fn) {
    class CustomBlockTag {
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

        // get the contents in between the beginning and end blocks
        const body = parser.parseUntilBlocks(`end${name}`);

        // finish out the end block
        parser.advanceAfterBlockEnd();

        return new nodes.CallExtension(this, 'run', args, [body]);
      }

      run(_, ...args) {
        // the body is always the last item
        const body = args.pop();

        // pass the function through to nunjucks with the parameters
        return new runtime.SafeString(fn(body(), ...args));
      }
    }

    this.env.addExtension(name, new CustomBlockTag());
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

// native
import * as path from 'path';

// packages
import fs from 'fs-extra';
import {
  Environment,
  FileSystemLoader,
  NodeResolveLoader,
  runtime,
  Template,
} from 'nunjucks';

// local
const { Engine } = require('./base');
const { isProductionEnv } = require('../env');

interface NunjucksContext {
  [key: string]: string;
}

class NunjucksEngine extends Engine {
  layouts: string;
  env: Environment;
  context: NunjucksContext;

  constructor({ layouts, ...args }: { layouts: string }) {
    super(args);

    // the directory where Nunjucks templates and includes can be found
    this.layouts = layouts;

    // the glob pattern to use for finding files to process
    this.filePattern = '**/*.{html,njk}';

    this.ignorePattern = [this.layouts, ...this.ignorePattern];

    // handles loading template files from the file system
    const fileLoader = new FileSystemLoader([this.layouts, this.input], {
      noCache: true,
    });

    // handles loading template files from node_modules
    const nodeLoader = new NodeResolveLoader({ noCache: true });

    // the prepared nunjucks environemnt
    this.env = new Environment([fileLoader, nodeLoader], {
      autoescape: false,
      throwOnUndefined: true,
      trimBlocks: true,
    });

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

  async compile(file: string) {
    // read the raw string
    const raw = await fs.readFile(file, 'utf8');

    // create the template
    const template = new Template(raw, this.env, path.resolve(file));

    return function render(context: NunjucksContext) {
      return new Promise((resolve, reject) => {
        template.render(context, (err: Error, text: string) => {
          if (err) reject(err);

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

  async render(file: string) {
    // compile the Nunjucks template
    const render = await this.compile(file);

    // mark this file as a dependency
    this.addDependency(file);

    let results = await render(this.context);

    if (isProductionEnv) {
      results = this.minifier(results, { collapseWhitespace: true });
    }

    return results;
  }

  addCustomFilter(name: string, fn: Function) {
    this.env.addFilter(name, fn);
  }

  addCustomFilters(obj) {
    for (const [name, fn] of Object.entries(obj)) {
      this.addCustomFilter(name, fn);
    }
  }

  addCustomTag(name, fn) {
    class CustomTag {
      tags: string[];

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

        const CallExtension = fn.async
          ? nodes.CallExtensionAsync
          : nodes.CallExtension;

        // pass things along to run()
        return new CallExtension(this, 'run', args);
      }

      run(_, ...args) {
        // pass the function through to nunjucks with the parameters
        return new runtime.SafeString(fn(...args));
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
  static async renderOnly(filepath: string, context: NunjucksContext) {
    // read the raw string
    const raw = await fs.readFile(filepath, 'utf8');

    // create the template
    const template = new Template(raw, path.resolve(filepath));

    // resolve the render
    return new Promise((resolve, reject) => {
      template.render(context, (err: Error, text: string) => {
        if (err) reject(err);

        resolve(text);
      });
    });
  }
}

module.exports = { NunjucksEngine };

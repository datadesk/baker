// native
import { promises as fs } from 'fs';
import { join, parse, relative, resolve } from 'path';

// packages
import { createCodeFrame } from 'simple-code-frame';
import chokidar from 'chokidar';
import debug from 'debug';
import nunjucks from 'nunjucks';
import { Environment, FileSystemLoader, Template } from 'nunjucks';

// local
import { BaseEngine } from './base.js';
import { isProductionEnv, nodeEnv } from '../env.js';
import { outputFile } from '../utils.js';

const logger = debug('baker:engines:nunjucks');

export class NunjucksEngine extends BaseEngine {
  constructor({ layouts, createPages, nodeModules, globalVariables, ...args }) {
    super(args);

    this.name = 'nunjucks';

    // the directory where Nunjucks templates and includes can be found
    this.layouts = layouts;

    // the likely location of the local node_modules directory
    this.nodeModules = nodeModules;

    // an optional generate function for dynamic pages
    this.createPages = createPages;

    // the glob pattern to use for finding files to process
    this.filePattern = '**/*.{html,njk}';

    // any files or paths to ignore when searching
    this.ignorePattern = [this.layouts, ...this.ignorePattern];

    // handles loading template files from the file system
    const fileLoader = new FileSystemLoader(
      [this.layouts, this.input, this.nodeModules],
      {
        noCache: !isProductionEnv,
      }
    );

    // the prepared nunjucks environment
    this.env = new Environment([fileLoader], {
      autoescape: false,
      dev: !isProductionEnv,
      throwOnUndefined: true,
      trimBlocks: true,
    });

    // add global reference to the current Node environment
    this.env.addGlobal('NODE_ENV', nodeEnv);

    // add global reference to the domain
    this.env.addGlobal('DOMAIN', this.domain);

    // add global reference to the current path prefix
    this.env.addGlobal('PATH_PREFIX', this.pathPrefix);

    // add global reference to the current time
    this.env.addGlobal('NOW', new Date());

    // add any global variables submitted to this function
    for (const [key, value] of Object.entries(globalVariables)) {
      this.env.addGlobal(key, value);
    }

    // a hack to keep track of which dependencies each input uses
    this.inputPath = undefined;

    this.env.on('load', (_, { path: templatePath }) => {
      logger('├╶╶ loading dependency', relative(this.input, templatePath));
      this.addDependency(templatePath, this.inputPath);
    });

    this.context = {};
  }

  getOutputPath({ base, ext, input, name }) {
    // If this is one of our data extensions, we return
    // the path "as is" to preserve the file name in the URL.
    const dataExt = ['.txt', '.yaml', '.yml', '.json', '.xml', '.csv', '.tsv'];
    if (dataExt.includes(ext)) {
      return input;
    }

    // For other files, which are expected to be HTML,
    // we always use "pretty" URLs, so we alter the pathname if it is index.html
    const pathname =
      name === 'index' ? input.replace(base, '') : input.replace(ext, '');
    return join(pathname, 'index.html');
  }

  async compile(file) {
    // read the raw string
    const raw = await fs.readFile(file, 'utf8');

    // create the template
    const template = new Template(raw, this.env, resolve(file));

    const render = (context) => {
      return new Promise((resolve, reject) => {
        template.render(context, async (err, text) => {
          if (err) {
            if (err.lineno && err.colno) {
              err.frame = createCodeFrame(raw, err.lineno, err.colno);
            }

            reject(err);
          }

          resolve(text);
        });
      });
    };

    return render;
  }

  loadHTMLMinifier() {
    // this is a big import, so only load it if necessary
    if (!this.__minifier__) {
      this.__minifier__ = import('html-minifier-terser').then(
        (module) => module.minify
      );
    }

    return this.__minifier__;
  }

  collectDynamicRenders() {
    const renders = [];

    const collect = (inputPath, outputPath, localContext) => {
      const template = join(this.layouts, inputPath);
      renders.push([template, outputPath, localContext]);
    };

    return { collect, renders };
  }

  async outputFile(inputPath, outputPath, localContext = {}) {
    // grab the path relative to the source directory
    const input = relative(this.input, inputPath);

    // pull the relative path's parts
    const parts = parse(outputPath || input);

    // pivot on whether this is an index file or not
    const pathname = parts.name === 'index' ? '/' : `${parts.name}/`;

    // prepare the current path
    const currentPath = join(this.pathPrefix, parts.dir, pathname);

    // determine our outputPath, using the custom one if provided
    const output = this.getOutputPath({
      input: outputPath ? outputPath : input,
      ...parts,
    });

    // build the complete URL, using this.domain if it's set
    const currentUrl = this.domain
      ? new URL(currentPath, this.domain)
      : currentPath;

    // prepare the absolute URL to be passed to context
    const absoluteUrl = currentUrl.toString();

    // prep the page tracking object
    // TODO: get rid of the snakecase variables in 1.0
    const page = {
      url: currentPath,
      absoluteUrl,
      absolute_url: absoluteUrl,
      inputPath: input,
      outputPath: output,
    };

    // mark this file as a dependency
    this.addDependency(inputPath, inputPath);

    // set it as the current input
    this.inputPath = inputPath;

    // compile the Nunjucks template
    const render = await this.compile(inputPath);

    // prepare the render context, accounting for a possible local pass-in
    const context = { ...this.context, ...localContext };

    // render the page
    // TODO: Get rid of current_page in 1.0
    let content = await render({ page, current_page: page, ...context });
    logger(`└${isProductionEnv ? '┮' : '╼'} finished render of`, input);

    // if we are in production, minify this
    if (isProductionEnv) {
      const minifier = await this.loadHTMLMinifier();
      content = await minifier(content, this.minifyOptions);
      logger(' ┕ finished minify of rendered', input);
    }

    // build our absolute path for writing
    const absolute = join(this.output, output);

    // write to disk
    await outputFile(absolute, content);

    // save a reference how the file path was modified
    this.manifest[input] = output;

    return output;
  }

  async build() {
    // clear out the dependencies and manifest
    this.invalidate();

    // find the files to work with
    const files = await this.findFiles();

    try {
      for (const file of files) {
        logger('┌╼ rendering', relative(this.input, file));
        await this.outputFile(file);
      }
      // if we have a dynamic generator, let's find them
      if (this.createPages) {
        const { collect, renders } = this.collectDynamicRenders();
        await this.createPages(collect, this.context);

        for (const [inputPath, outputPath, localContext] of renders) {
          logger('┌╼ dynamically rendering', outputPath);
          await this.outputFile(inputPath, outputPath, localContext);
        }
      }
    } catch (err) {
      throw err;
    }
  }

  /**
   * @param {string} name
   * @param {any} value
   */
  addCustomGlobal(name, value) {
    this.env.addGlobal(name, value);
  }

  /**
   * @param {string} name The name of the filter
   * @param {(...args) => unknown} fn The function for the filter
   */
  addCustomFilter(name, fn) {
    this.env.addFilter(name, fn.bind(this));
  }

  /**
   * @param {{[name: string]: (...args) => unknown}} obj
   */
  addCustomFilters(obj) {
    for (const [name, fn] of Object.entries(obj)) {
      this.addCustomFilter(name, fn);
    }
  }

  addCustomTag(name, fn) {
    const addDependency = this.addDependency.bind(this);
    const isAsync = fn.async;

    class CustomTag {
      constructor() {
        this.tags = [name];
      }

      parse(parser, nodes) {
        // prep args variable
        let args;

        // get the tag token
        const token = parser.nextToken();

        // parse the supplied args
        args = parser.parseSignature(true, true);

        // step around bug with no-args tags
        if (args.children.length === 0) {
          args.addChild(new nodes.Literal(0, 0, ''));
        }

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
          const resolve = args.pop();

          fn(...args)
            .then((value, dependencies = []) => {
              for (const dependency of dependencies) {
                addDependency(dependency);
              }

              resolve(null, new nunjucks.runtime.SafeString(value));
            })
            .catch((err) => {
              resolve(err);
            });
        } else {
          const value = fn(...args);
          // pass the function through to nunjucks with the parameters
          return new nunjucks.runtime.SafeString(value);
        }
      }
    }

    this.env.addExtension(name, new CustomTag());
  }

  /**
   * @param {{[name: string]: (...args) => unknown}} obj
   */
  addCustomTags(obj) {
    for (const [name, fn] of Object.entries(obj)) {
      this.addCustomTag(name, fn);
    }
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
        return new nunjucks.runtime.SafeString(fn(body(), ...args));
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
    const template = new Template(raw, resolve(filepath));

    // resolve the render
    return new Promise((resolve, reject) => {
      template.render(context, (err, text) => {
        if (err) reject(err);

        resolve(text);
      });
    });
  }

  async watch(fn) {
    const toWatch = Array.from(this.dependencies);

    this.watcher = chokidar.watch(toWatch, {
      ignoreInitial: true,
    });

    const onChange = async (path) => {

      // find the files to work with
      const files = await this.findFiles();

      try {
        for (const file of files) {
          if (file !== path)
            continue;
          logger('┌╼ rendering', relative(this.input, file));
          await this.outputFile(file);
        }
        // if we have a dynamic generator, let's find them
        if (this.createPages) {
          const { collect, renders } = this.collectDynamicRenders();
          await this.createPages(collect, this.context);

          for (const [inputPath, outputPath, localContext] of renders) {
            if (inputPath !== path)
              continue;
            logger('┌╼ dynamically rendering', outputPath);
            await this.outputFile(inputPath, outputPath, localContext);
          }
        }
      } catch (err) {
        throw err;
      }
    };

    this.watcher.on('add', onChange);
    this.watcher.on('change', onChange);
    this.watcher.on('unlink', onChange);
  }
}

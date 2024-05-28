// native
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import EventEmitter from 'events';
import { join, resolve, basename, dirname } from 'path';

// packages
import chokidar from 'chokidar';
import { green, yellow } from 'colorette';
import debounce from 'lodash.debounce';
import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';
import * as journalize from 'journalize';
import { premove } from 'premove';
import glob from 'fast-glob';

// local
import { isProductionEnv } from './env.js';
import { clearConsole, onError, printInstructions } from './utils.js';

// blocks
import { createInjectBlock } from './blocks/inject.js';
import { createScriptBlock } from './blocks/script.js';
import {
  createStaticBlock,
  createStaticAbsoluteBlock,
} from './blocks/static.js';

// filters
import { dateFilter } from './filters/date.js';
import { jsonScriptFilter } from './filters/json-script.js';
import { logFilter } from './filters/log.js';

// engines
import { AssetsEngine } from './engines/assets.js';
import { NunjucksEngine } from './engines/nunjucks.js';
import { RollupEngine } from './engines/rollup.js';
import { SassEngine } from './engines/sass.js';

/**
 * @typedef {Object} BakerOptions
 * @property {string} assets
 * @property {Function} [createPages]
 * @property {string} data
 * @property {string} [domain]
 * @property {string} entrypoints
 * @property {string} input
 * @property {string} layouts
 * @property {{[key: string]: (...args) => unknown}} [nunjucksVariables]
 * @property {{[key: string]: (...args) => unknown}} [nunjucksFilters]
 * @property {{[key: string]: (...args) => unknown}} [nunjucksTags]
 * @property {{[key: string]: (...args) => unknown}} [minifyOptions]
 * @property {string} output
 * @property {string} pathPrefix
 * @property {string} staticRoot
 * @property {import('svelte/types/compiler/interfaces').CompileOptions} [svelteCompilerOptions]
 */

export class Baker extends EventEmitter {
  /**
   * @param {BakerOptions} config
   */
  constructor({
    assets,
    createPages,
    data,
    domain,
    embeds,
    entrypoints,
    input,
    layouts,
    nunjucksVariables,
    nunjucksFilters,
    nunjucksTags,
    minifyOptions,
    output,
    pathPrefix,
    staticRoot,
    svelteCompilerOptions,
  }) {
    super();

    // the input directory of this baker
    this.input = resolve(input);

    // load the dotfile if it exists
    dotenvExpand.expand(dotenv.config({ path: resolve(this.input, '.env') }));

    // the likely location of the local node_modules directory
    this.nodeModules = resolve(process.cwd(), 'node_modules');

    // where we will be outputting processed files
    this.output = resolve(input, output);

    // a special directory of files that should be considered extendable
    // templates by Nunjucks
    this.layouts = resolve(input, layouts);

    // a special directory where data files for passing to templates are loaded
    this.data = resolve(input, data);

    // a special directory where asset files live
    this.assets = resolve(input, assets);

    // console.log('this.assets is...', this.assets);

    // folder for web component embeds
    this.embeds = resolve(input, embeds);

    // where in the output directory non-HTML files should go
    this.staticRoot = staticRoot;

    // the path to a file, an array of paths, or a glob for determining what's
    // considered an entrypoint for script bundles
    this.entrypoints = entrypoints;

    // a path prefix that should be applied where needed to static asset paths
    // to prep for deploy, ensures there's a leading slash
    this.pathPrefix = isProductionEnv ? resolve('/', pathPrefix) : '/';

    // the root domain for the project, which will get pulled into select
    // places for URL building
    this.domain = domain ? domain : undefined;

    // an optional function that can be provided to Baker to dynamically generate pages
    this.createPages = createPages;

    // the default input and output arguments passed to each engine
    const defaults = {
      domain: this.domain,
      input: this.input,
      output: this.output,
      pathPrefix: this.pathPrefix,
      staticRoot: this.staticRoot,
    };

    this.assets = new AssetsEngine({
      dir: this.assets,
      ...defaults,
    });

    // for sass compiling
    this.sass = new SassEngine({
      includePaths: [this.nodeModules],
      assets: this.assets,
      ...defaults,
    });

    // for scripts
    this.rollup = new RollupEngine({
      entrypoints: this.entrypoints,
      svelteCompilerOptions,
      ...defaults,
    });

    // for nunjucks compiling
    this.nunjucks = new NunjucksEngine({
      layouts: this.layouts,
      nodeModules: this.nodeModules,
      createPages: this.createPages,
      globalVariables: nunjucksVariables || {},
      ...defaults,
    });

    // add all the features of journalize to nunjucks as filters
    this.nunjucks.addCustomFilters(journalize);

    // add our custom inject tag
    const injectBlock = createInjectBlock(this.output, [
      this.assets,
      this.sass,
    ]);

    this.nunjucks.addCustomTag('inject', injectBlock);

    // create our static tag
    const staticBlock = createStaticBlock(this.input, this.pathPrefix, [
      this.assets,
      this.sass,
    ]);

    // save a reference to our static block function for use elsewhere
    // TODO: refactor away in v1
    this.getStaticPath = staticBlock;
    this.nunjucks.getStaticPath = staticBlock;

    // hook up our custom static tag and pass in the manifest
    this.nunjucks.addCustomTag('static', staticBlock);

    const staticAbsoluteBlock = createStaticAbsoluteBlock(
      this.input,
      this.domain,
      this.pathPrefix,
      [this.assets, this.sass]
    );

    // save a reference to our static block function for use elsewhere
    // TODO: refactor away in v1
    this.getStaticAbsolutePath = staticAbsoluteBlock;
    this.nunjucks.getStaticAbsolutePath = staticAbsoluteBlock;

    // hook up our custom static absolute tag and pass in the manifest
    this.nunjucks.addCustomTag('staticabsolute', staticAbsoluteBlock);

    // add the "script" inject tag to nunjucks
    this.nunjucks.addCustomTag(
      'script',
      createScriptBlock(this.pathPrefix, this.rollup)
    );

    // a custom date filter based on date-fns "format" function
    this.nunjucks.addCustomFilter('date', dateFilter);
    this.nunjucks.addCustomFilter('log', logFilter);
    this.nunjucks.addCustomFilter('jsonScript', jsonScriptFilter);

    // if an object of custom nunjucks filters was provided, add them now
    if (nunjucksFilters) {
      this.nunjucks.addCustomFilters(nunjucksFilters);
    }

    // if an object of custom nunjucks tags was provided, add them now
    if (nunjucksTags) {
      this.nunjucks.addCustomTags(nunjucksTags);
    }

    // Set the nunjucks minification options
    this.nunjucks.minifyOptions = minifyOptions || { collapseWhitespace: true };

    // hook up our custom sass functions
    this.sass.addFunction(
      'static-path($file)',
      (sass) => ($file) => new sass.types.String(staticBlock($file.getValue()))
    );

    this.sass.addFunction(
      'static-url($file)',
      (sass) => ($file) =>
        new sass.types.String(`url(${staticBlock($file.getValue())})`)
    );
  }

  async getData() {
    const { load } = await import('quaff');

    try {
      return await load(this.data);
    } catch (err) {
      // the directory didn't exist and that's okay
      if (err.code === 'ENOENT') {
        return {};
      }

      // otherwise we want the real error
      throw err;
    }
  }

  async serve() {
    // remove the output directory to make sure it's clean
    await premove(this.output);

    // we only load mini-sync if it is being used
    const { create } = await import('mini-sync');

    // prep the server instance
    const server = create({
      dir: [this.output, this.input],
      port: 3000,
    });

    // track the errors
    let templatesError = null;
    let stylesError = null;
    let scriptsError = null;
    let dataError = null;
    let assetsError = null;

    clearConsole();
    console.log(yellow('Starting initial serve...'));

    let data;

    try {
      data = await this.getData();
    } catch (err) {
      dataError = err;
    }

    try {
      await this.assets.build();
    } catch (err) {
      assetsError = err;
    }

    // we need an initial run to populate the manifest
    try {
      await this.sass.build();
    } catch (err) {
      stylesError = err;
    }

    try {
      this.rollup.context = data;
      await this.rollup.build();
    } catch (err) {
      scriptsError = err;
    }

    try {
      this.nunjucks.context = data;
      await this.nunjucks.build();
    } catch (err) {
      templatesError = err;
    }

    const { local, network: external } = await server.start();

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

      if (dataError) {
        hadError = true;
        onError('Data', dataError);
      }

      if (assetsError) {
        hadError = true;
        onError('Assets', assetsError);
      }

      if (!hadError) {
        console.log(green('Project compiled successfully!'));
        printInstructions({ external, local });
      }
    };

    // our initial status log
    logStatus();

    // set up the watcher
    this.sass.watch((err, outputs) => {
      if (err) {
        stylesError = err;
      } else {
        stylesError = null;

        for (const output of outputs) {
          server.reload(resolve(this.pathPrefix, output));
        }
      }

      logStatus();
    });

    this.rollup.watch((err) => {
      if (err) {
        scriptsError = err;
      } else {
        scriptsError = null;

        server.reload();
      }

      logStatus();
    });

    this.nunjucks.watch((err) => {
      if (err) {
        templatesError = err;
      } else {
        templatesError = null;

        server.reload();
      }

      logStatus();
    });

    this.assets.watch((err) => {
      if (err) {
        assetsError = err;
      } else {
        assetsError = null;
      }

      logStatus();
    });

    const dataWatcher = chokidar.watch(join(this.data, '**/*'), {
      ignoreInitial: true,
    });

    const onChange = debounce(async () => {
      let data;

      dataError = null;
      scriptsError = null;
      templatesError = null;

      try {
        data = await this.getData();
      } catch (err) {
        dataError = err;
      }

      this.rollup.context = data;
      this.nunjucks.context = data;

      try {
        this.rollup.context = data;
        await this.rollup.build();
      } catch (err) {
        scriptsError = err;
      }

      try {
        this.nunjucks.context = data;
        await this.nunjucks.build();
      } catch (err) {
        templatesError = err;
      }

      if (!dataError && !scriptsError && !templatesError) {
        server.reload();
      }

      logStatus();
    }, 200);

    ['add', 'change', 'unlink'].forEach((event) => {
      dataWatcher.on(event, onChange);
    });
  }

  /**
   * filenames is an array of strings
   * @param {string[]} filenames
   * @returns {Promise<void>}
   */
  async bakeEmbeds(filenames) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const htmlStringMapper = {};

    for (const filename of filenames) {
      try {
        const filePath = resolve(__dirname, filename);
        const basePath = dirname(filePath);
        const htmlStringIdentifier = basename(basePath);

        htmlStringMapper[htmlStringIdentifier] = await fs.readFile(
          filePath,
          'utf-8'
        );
      } catch (err) {
        console.error(`Failed to read file: ${filename}`, err);
      }
    }

    const embedScriptContent = `
      (() => {
        class BakerWebComponent extends HTMLElement {
          constructor() {
            super();
            this.htmlStringMapper = ${JSON.stringify(htmlStringMapper)};
          }

          async connectedCallback() {
            const shadow = this.attachShadow({ mode: "open" });

            // Create the wrapper element
            const wrapper = document.createElement('div');
            // fallback with default html value with no element found with the id
            wrapper.innerHTML = this.htmlStringMapper[this.id] || '<div>Element not found</div>'

            // Append the link and wrapper to the shadow DOM
            shadow.appendChild(wrapper);
          }
        }

        class BakerEmbed {
          constructor() {
            this.customElementName = "baker-element";
            this.webComponentClass = BakerWebComponent;
          }

          registerCustomElement() {
            if (!customElements.get(this.customElementName)) {
              customElements.define(this.customElementName, this.webComponentClass);
            }
          }

          initializeComponents() {
            const scriptTags = document.body.querySelectorAll(
              'script[src*="bundle."]'
            );
            scriptTags.forEach((script) => {
              if (script.src) {
                const customElement = document.createElement(this.customElementName);
                const elementId = script.getAttribute("data-element-id");
                if (elementId) {
                  customElement.id = elementId;
                }
                script.parentNode.appendChild(customElement);
              }
            });
          }

          start() {
            this.registerCustomElement();
            this.initializeComponents();
          }

          static render() {
            const app = new BakerEmbed();
            app.start();
          }
        }

        // Initialize and render the app
        if (document.readyState === "loading") {
          window.addEventListener("DOMContentLoaded", BakerEmbed.render);
        } else {
          BakerEmbed.render();
        }
      })()
    `;
    const embedScriptPath = join('lib', 'baker-bundle.js');
    await fs.writeFile(embedScriptPath, embedScriptContent, 'utf8');

    await this.rollup.buildEmbed(embedScriptPath, join(this.output, 'embeds'));
  }

  async bake() {
    // emit event that a bake has begun
    this.emit('bake:start');

    // remove the output directory to make sure it's clean
    await premove(this.output);

    // prep the data
    const data = await this.getData();

    // pass the data context to rollup and nunjucks
    this.rollup.context = data;
    this.nunjucks.context = data;

    // wait for all the assets to prepare first
    await this.assets.build();

    // compile the rest of the assets
    await Promise.all([this.sass.build(), this.rollup.build()]);

    // build the HTML
    await this.nunjucks.build();

    // bake the embeds after _dist is built
    if (this.embeds) {
      let embedFiles = await glob(join(this.output, 'embeds/*', '*.html'), {
        ignore: 'node_modules/**',
      });
      await this.bakeEmbeds(embedFiles);
    }

    // emit event that a bake has completed
    this.emit('bake:end');
  }
}

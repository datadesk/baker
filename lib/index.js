// native
import EventEmitter from 'events';
import { join, resolve } from 'path';

// packages
import chokidar from 'chokidar';
import { green, yellow } from 'colorette';
import debounce from 'lodash.debounce';
import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';
import * as journalize from 'journalize';
import { premove } from 'premove';
import glob from 'fast-glob';
import fetch from 'node-fetch';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';

// local
import { isProductionEnv, getBasePath } from './env.js';
import {
  clearConsole,
  onError,
  printInstructions,
} from './utils.js';

// blocks
import { createInjectBlock } from './blocks/inject.js';
import { createScriptBlock } from './blocks/script.js';
import {
  createStaticAbsoluteBlock,
  createStaticBlock,
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

const CROSSWALK_ALLOWED_IMG_EXT = [ 'jpg', 'png', 'avif', 'webp' ];
const CROSSWALK_ALLOWED_AUD_EXT = [ 'mp3' ];
const CROSSWALK_ALLOWED_VID_EXT = [ 'mp4', 'webm' ];

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
 * @property {function(string): function(Object.<string, string>[]): Object.<string, string>[]} nunjucksFilters.prepareCrosswalk
 * @property {{[key: string]: (...args) => unknown}} [nunjucksTags]
 * @property {{[key: string]: (...args) => unknown}} [minifyOptions]
 * @property {string} output
 * @property {string} pathPrefix
 * @property {string} staticRoot
 * @property {string} [crosswalkPath]
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
    crosswalkData = {},
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

    // where in the output directory non-HTML files should go
    this.staticRoot = staticRoot;

    this.embeds = embeds;

    // the path to a file, an array of paths, or a glob for determining what's
    // considered an entrypoint for script bundles
    this.entrypoints = entrypoints;

    // a path prefix that should be applied where needed to static asset paths
    // to prep for deploy, ensures there's a leading slash
    this.pathPrefix = isProductionEnv ? resolve('/', pathPrefix) : '/';

    // the root domain for the project, which will get pulled into select
    // places for URL building
    this.domain = domain ? domain : undefined;

    this.basePath = getBasePath(domain);

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
    const staticBlock = createStaticBlock(this.input, this.pathPrefix, this.basePath, [
      this.assets,
      this.sass,
    ]);

    // save a reference to our static block function for use elsewhere
    // TODO: refactor away in v1
    this.getStaticPath = staticBlock;
    this.nunjucks.getStaticPath = staticBlock;

    const staticAbsoluteBlock = createStaticAbsoluteBlock(
      this.input,
      this.domain,
      this.pathPrefix,
      [this.assets, this.sass]
    );

    // hook up our custom static tag and pass in the manifest
    this.nunjucks.addCustomTag(
      'static',
      isProductionEnv &&
        process.env.BAKER_BASE_PATH &&
        process.env.BAKER_PATH_PREFIX
        ? staticAbsoluteBlock
        : staticBlock
    );

    // save a reference to our static block function for use elsewhere
    // TODO: refactor away in v1
    this.getStaticAbsolutePath = staticAbsoluteBlock;
    this.nunjucks.getStaticAbsolutePath = staticAbsoluteBlock;

    // hook up our custom static absolute tag and pass in the manifest
    this.nunjucks.addCustomTag('staticabsolute', staticAbsoluteBlock);

    // hook up our custom static tag and pass in the manifest
    this.nunjucks.addCustomTag('static', staticBlock);

    // add the "script" inject tag to nunjucks
    this.nunjucks.addCustomTag(
      'script',
      createScriptBlock(this)
    );

    // a custom date filter based on date-fns "format" function
    this.nunjucks.addCustomFilter('date', dateFilter);
    this.nunjucks.addCustomFilter('log', logFilter);
    this.nunjucks.addCustomFilter('jsonScript', jsonScriptFilter);

    // if an object of custom nunjucks filters was provided, add them now
    if (nunjucksFilters) {
      this.nunjucks.addCustomFilters(nunjucksFilters);
    }

    if (crosswalkData) {
      this.nunjucks.addCustomFilter('prepareCrosswalk', this.prepareCrosswalk(crosswalkData));
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

  /**
   * Prepares a function to process crosswalk image paths.
   * @returns {Function} A function that maps over data entries to update image paths.
   */
  prepareCrosswalk() {
    /**
     * @typedef {Object} CrosswalkImage
     * @property {string} Filepath for the jpg version of this image
     * @property {string} Filepath for the png version of this image
     * @property {string} Filepath for the avif version of this image
     * @property {string} Filepath for the webp version of this image
     **/

    /**
     * @typedef {Object} CrosswalkAudio
     * @property {string} Filepath for the mp3 version of this audio
     **/

    /**
     * @typedef {Object} CrosswalkVideo
     * @property {string} Filepath for the mp4 version of this video
     * @property {string} Filepath for the wemb version of this video
     **/

    /**
     * @typedef {Object} CrosswalkData
     * @property {Object.<string, CrosswalkImage>} Object containing CrosswalkImage configurations
     * @property {Object.<string, CrosswalkAudio>} Object containing CrosswalkAudio configurations
     * @property {Object.<string, CrosswalkVideo>} Object containing CrosswalkVideo configurations
     **/

    /**
     * Processes data entries to set appropriate paths for images.
     * @param {CrosswalkData} data - Array of objects, each containing image references.
     * @returns {CrosswalkData} The data with updated image paths.
     */
    return function setCrosswalkDefaultPaths(
      /** @type {CrosswalkData} */ data
    ) {
      const { assets, ...additionalData } = data;
      const { img, aud, vid } = assets;

      if (!img && !aud && !vid) {
        console.warn('No crosswalk static assets found. Is your crosswalk data formatted correctly?');
      }

      const preppedData = { ...additionalData };

      const fixCrosswalkPaths = (
        assetType,
        obj,
        allowedExtensions,
        requiredExtensions = []
      ) => {
        const exts = Object.keys(obj);

        if (requiredExtensions.length) {
          if (!exts.some((ext) => requiredExtensions.includes(ext))) {
            throw new Error(
              `Crosswalk entry missing at least one required asset type ${assetType}: [${requiredExtensions.join(
                ', '
              )}]`
            );
          }
        }

        return exts.reduce((result, ext) => {
          if (!allowedExtensions.includes(ext)) {
            console.warn(`Attribute not allowed for asset type: ${assetType}`);
            return result;
          }

          const path = obj[ext];
          result[ext] = this.getStaticPath(path);
          return result;
        }, {});
      };

      if (img) {
        preppedData.img = fixCrosswalkPaths(
          'img',
          img,
          CROSSWALK_ALLOWED_IMG_EXT
        );
      }

      if (aud) {
        preppedData.aud = fixCrosswalkPaths(
          'aud',
          aud,
          CROSSWALK_ALLOWED_AUD_EXT
        );
      }

      if (vid) {
        preppedData.vid = fixCrosswalkPaths(
          'vid',
          vid,
          CROSSWALK_ALLOWED_VID_EXT
        );
      }

      return preppedData;
    };
  }

  /**
   * Sends a successful build notification to the currently defined webhook url
   * @returns {Promise<void>}
   */
  async sendWebhookRequest() {
    if (!process.env.BUILD_NOTIFICATION_WEBHOOK_URL) return;

    const files = await glob(join(this.embeds, '*.html'));
    if (files.length === 0) return;

    const pathObject = path.parse(files[0]);
    const pathArray = pathObject.dir.split(path.sep);
    const projectSlug = pathArray[pathArray.length - 2];

    const payload = {
      data: {
        id: uuidv4(),
        objType: 'baker-project',
        attributes: {
          projectSlug,
          embeds: files.map((file) => path.parse(file).name),
        },
      },
    };

    fetch(process.env.BUILD_NOTIFICATION_WEBHOOK_URL, {
      method: 'post',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });
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

    // send webhook to notify of build completion
    await this.sendWebhookRequest();

    // emit event that a bake has completed
    this.emit('bake:end');
  }
}

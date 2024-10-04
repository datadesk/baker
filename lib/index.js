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
import puppeteer from 'puppeteer';

// local
import { isProductionEnv, getBasePath } from './env.js';
import {
  clearConsole,
  onError,
  printInstructions,
  validAudioExtensions,
  validImageExtensions,
  validVideoExtensions,
} from './utils.js';

// blocks
import { createInjectBlock } from './blocks/inject.js';
import { createScriptBlock } from './blocks/script.js';
import { createStaticBlock } from './blocks/static.js';

// filters
import { dateFilter } from './filters/date.js';
import { jsonScriptFilter } from './filters/json-script.js';
import { logFilter } from './filters/log.js';

// engines
import { AssetsEngine } from './engines/assets.js';
import { NunjucksEngine } from './engines/nunjucks.js';
import { RollupEngine } from './engines/rollup.js';
import { SassEngine } from './engines/sass.js';

const CROSSWALK_ALLOWED_ASSET_TYPES = [
  'img',
  'aud',
  'vid'
];

const CROSSWALK_ALLOWED_EXTS = {
  img: validImageExtensions.map((ext) => ext.replace('.', '')),
  aud: validAudioExtensions.map((ext) => ext.replace('.', '')),
  vid: validVideoExtensions.map((ext) => ext.replace('.', '')),
};

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

    this.basePath = getBasePath(domain, this.pathPrefix);

    // an optional function that can be provided to Baker to dynamically generate pages
    this.createPages = createPages;

    // the default input and output arguments passed to each engine
    const defaults = {
      domain: this.domain,
      input: this.input,
      output: this.output,
      pathPrefix: this.pathPrefix,
      staticRoot: this.staticRoot,
      basePath: this.basePath,
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
    const staticBlock = createStaticBlock(this.input, [this.assets, this.sass]);

    // save a reference to our static block function for use elsewhere
    // TODO: refactor away in v1
    this.getStaticPath = staticBlock;
    this.nunjucks.getStaticPath = staticBlock;

    // hook up our custom static tag and pass in the manifest
    this.nunjucks.addCustomTag('static', staticBlock);

    // create our script tag
    this.nunjucks.addCustomTag('script', createScriptBlock(this.rollup));

    // a custom date filter based on date-fns "format" function
    this.nunjucks.addCustomFilter('date', dateFilter);
    this.nunjucks.addCustomFilter('log', logFilter);
    this.nunjucks.addCustomFilter('jsonScript', jsonScriptFilter);

    // if an object of custom nunjucks filters was provided, add them now
    if (nunjucksFilters) {
      this.nunjucks.addCustomFilters(nunjucksFilters);
    }

    this.nunjucks.addCustomFilter('prepareCrosswalk', this.prepareCrosswalk);

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
   * @typedef {Object} CrosswalkImage
   * @property {string} jpg Filepath for the jpg version of this image
   * @property {string} png Filepath for the png version of this image
   * @property {string} avif Filepath for the avif version of this image
   * @property {string} webp Filepath for the webp version of this image
   **/

  /**
   * @typedef {Object} CrosswalkAudio
   * @property {string} mp3 Filepath for the mp3 version of this audio
   **/

  /**
   * @typedef {Object} CrosswalkVideo
   * @property {string} mp4 Filepath for the mp4 version of this video
   * @property {string} webm Filepath for the webm version of this video
   **/

  /**
   * @typedef {Object} CrosswalkAssets
   * @property {Object.<string, CrosswalkImage>} img Object containing CrosswalkImage configurations
   * @property {Object.<string, CrosswalkAudio>} aud Object containing CrosswalkAudio configurations
   * @property {Object.<string, CrosswalkVideo>} vid Object containing CrosswalkVideo configurations
   **/

  /**
   * @typedef {Object} CrosswalkData
   * @property {Object.<string, CrosswalkAssets>} assets Object containing all crosswalk static assets
   * @property {Array.<Object.<string, any>>} additionalData Array of additional, unrecognized data objects
   */

  /**
   * Prepares a function to process crosswalk image paths.
   * @param {Object.<string, string>[]} crossWalkRows - AN array of key/value pairs
   * @returns {CrosswalkData} A function that maps over data entries to update image paths.
   */
  prepareCrosswalk(crossWalkRows) {
    const preppedData = {
      assets: {},
      additionalData: [],
    };

    return crossWalkRows.reduce((acc, crosswalkRow) => {
      if (!crosswalkRow.assetType) {
        acc.additionalData.push(crosswalkRow);
        return acc;
      }

      const { assetName, assetType, ...assetSources } = crosswalkRow;

      const normalizedAssetName = assetName.toLowerCase();
      const normalizedAssetType = assetType.toLowerCase();

      if (!CROSSWALK_ALLOWED_ASSET_TYPES.includes(normalizedAssetType)) {
        throw new Error(
          `Crosswalk: Unrecognized assetType: ${normalizedAssetType} for asset ${normalizedAssetName}`
        );
      }

      if (!assetName) {
        throw new Error(
          "Crosswalk: Unable to process crowsswalk tsv/csv. Missing required 'assetName' column."
        );
      }

      if (
        normalizedAssetType === 'img' &&
        !assetSources.jpg &&
        !assetSources.png
      ) {
        throw new Error(
          'Crosswalk: Image assets require either a jpg or png file for basic compatibility.'
        );
      }

      if (normalizedAssetType === 'aud' && !assetSources.mp3) {
        throw new Error(
          'Crosswalk: Audio asset type requires a mp3 file for basic compatibility'
        );
      }

      if (normalizedAssetType === 'vid' && !assetSources.mp4) {
        throw new Error(
          'Crosswalk: Audio asset type requires a mp4 file for basic compatibility'
        );
      }

      if (!preppedData.assets[normalizedAssetType])
        preppedData.assets[normalizedAssetType] = {};
      preppedData.assets[normalizedAssetType][normalizedAssetName] = {};

      Object.entries(assetSources).forEach(([ext, path]) => {
        const allowedExtensions = CROSSWALK_ALLOWED_EXTS[normalizedAssetType];
        if (!allowedExtensions.includes(ext)) {
          console.warn(
            `Attribute: ${ext} not allowed for asset type: ${normalizedAssetType}. Skipping.`
          );
          return;
        }

        preppedData.assets[normalizedAssetType][normalizedAssetName][ext] =
          this.getStaticPath(path);
      });

      return acc;
    }, preppedData);
  }

  /**
   * Generates fallback images for web-component embeds.
   * @returns {Promise<void>}
   */

  async buildEmbedFallbacks() {
    const embedFiles = Object.values(this.nunjucks.manifest)
      .filter((path) => path.includes('embeds'));

    if (!embedFiles.length) return;

    const browser = await puppeteer.launch({
      headless: true,
    });

    for (const embedFilePath of embedFiles) {
      const fullScreenshotPath = join(this.output, embedFilePath);
      console.log(`Taking screenshot of: ${fullScreenshotPath}`);

      const page = await browser.newPage();
      await page.goto(`file://${fullScreenshotPath}`, { waitUntil: 'networkidle0' });

      const screenshotEmbedDir = fullScreenshotPath
        .split('/')
        .slice(0, -1)
        .join('/')
        .replace('_screenshot', '_dist');
      const screenshotStoragePath = join(screenshotEmbedDir, 'fallback.png');
      console.log(`Storing screenshot of: ${screenshotStoragePath}`);

      await page.screenshot({ path: screenshotStoragePath, fullPage: true });
      await page.close();
    }

    await browser.close();
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

  async buildDistribution() {
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
  }

  async bake() {
    // emit event that a bake has begun
    this.emit('bake:start');

    // build the distribution
    await this.buildDistribution();

    // emit event that a bake has completed
    this.emit('bake:end');
  }

  async screenshot() {
    // build the _screenshot directory
    await this.buildDistribution();

    // screenshot the embeds
    await this.buildEmbedFallbacks();
  }
}

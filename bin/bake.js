#!/usr/bin/env node

// native
import { bold, green, red } from 'colorette';
import { resolve } from 'path';

// packages
import debug from 'debug';
import mri from 'mri';

// local
import { Baker } from '../lib/index.js';
import { logErrorMessage } from '../lib/utils.js';

const logger = debug('baker:cli');

const OUTPUT_DIR = '_dist';
const SCREENSHOT_DIR = '_screenshot';

const defaultConfigFile = 'baker.config.js';

const defaultConfig = {
  assets: 'assets',
  createPages: undefined,
  data: '_data',
  domain: undefined,
  embeds: 'embeds',
  entrypoints: 'scripts/app.js',
  imageSrcSizes: undefined,
  input: process.cwd(),
  layouts: '_layouts',
  nunjucksVariables: undefined,
  nunjucksFilters: undefined,
  nunjucksTags: undefined,
  minifyOptions: undefined,
  svelteCompilerOptions: undefined,
  output: OUTPUT_DIR,
  pathPrefix: '/',
  staticRoot: '',
  crosswalkPath: undefined,
};

function getDefaultFromModule(module) {
  return module.__esModule ? module.default : module;
}

// async function compileAndLoadConfig(pathToConfig) {
//   const bundle = await rollup({
//     external: () => true,
//     input: pathToConfig,
//     treeshake: false,
//   });
//
//   const {
//     output: [{ code }],
//   } = await bundle.generate({
//     exports: 'named',
//     format: 'cjs',
//     interop: 'auto',
//   });
//   const loadedConfig = requireFromString(code, pathToConfig);
//
//   return getDefaultFromModule(loadedConfig);
// }

async function betterPrepareConfig(flags) {
  console.log('betterPrepareConfig:flags');
  console.log(JSON.stringify(flags, null, 3));

  const { input, config } = flags;
  console.log('betterPrepareConfig:input');
  console.log(input);
  console.log('betterPrepareConfig:config');
  console.log(config);

  const projectConfigFilePath = resolve(input, !!config ? config : defaultConfigFile);
  const projectConfigFile = await import(projectConfigFilePath);

  console.log('betterPrepareConfig:projectConfigFile');
  console.log(projectConfigFile);

  const projectConfig = getDefaultFromModule(projectConfigFile);
  console.log('betterPrepareConfig:projectConfig');
  console.log(projectConfig.default);

  const mergedConfig = {
    ...defaultConfig,
    ...projectConfig.default,
  };

  console.log('betterPrepareConfig:mergedConfig');
  console.log(JSON.stringify(mergedConfig, null, 3));

  return mergedConfig;
}

// async function prepareConfig(inputOptions) {
//   // the input directory everything is relative to
//   const input = inputOptions.input;
//
//   // a config parameter was passed
//   if (inputOptions.config) {
//     // we check to see if it was passed as a boolean and use our default path to the config, otherwise we use what was given
//     const pathToConfig = resolve(
//       input,
//       inputOptions.config === true ? defaultConfigFile : inputOptions.config
//     );
//
//     inputOptions = await compileAndLoadConfig(pathToConfig);
//   }
//
//   // prep a helper function to resolve paths against input
//   const resolver = (key) => inputOptions[key] || defaultConfig[key];
//
//   const options = {};
//
//   options.assets = resolver('assets');
//   options.createPages = resolver('createPages');
//   options.data = resolver('data');
//   options.domain = resolver('domain');
//   options.embeds = resolver('embeds');
//   options.entrypoints = resolver('entrypoints');
//   options.imageSrcSizes = resolver('imageSrcSizes');
//   options.input = resolver('input');
//   options.layouts = resolver('layouts');
//   options.nunjucksVariables = resolver('nunjucksVariables');
//   options.nunjucksFilters = resolver('nunjucksFilters');
//   options.nunjucksTags = resolver('nunjucksTags');
//   options.minifyOptions = resolver('minifyOptions');
//   options.output = resolver('output');
//   options.pathPrefix = resolver('pathPrefix');
//   options.staticRoot = resolver('staticRoot');
//   options.svelteCompilerOptions = resolver('svelteCompilerOptions');
//   options.crosswalkPath = resolver('crosswalkPath');
//
//   return options;
// }

const mriConfig = {
  alias: {
    a: 'assets',
    c: 'config',
    d: 'data',
    e: 'entrypoints',
    i: 'input',
    l: 'layouts',
    o: 'output',
    p: 'pathPrefix',
    s: 'staticRoot',
  },
  default: {
    input: process.cwd(),
  },
};

/**
 * The function that runs when the CLI is ran.
 *
 * @param {string[]} args The provided args
 */
async function run(args) {
  const { _, ...flags } = mri(args, mriConfig);

  const command = _[0];
  const config = await betterPrepareConfig(flags);

  logger('command:', command);
  logger('resolved input flags:', config);

  const baker = new Baker(config);

  switch (command) {
    case 'bake':
    case 'build':
      try {
        await baker.bake();

        console.log(green(bold('The build was a success!')));
      } catch (err) {
        console.log(
          red(bold("Build failed. Here's what possibly went wrong:\n"))
        );
        logErrorMessage(err);
        process.exit(1);
      }
      break;
    case 'screenshot':
      // Change a few config options for taking screenshots
      const screenshotConfig = { ...config, output: SCREENSHOT_DIR };
      const screenshotBaker = new Baker(screenshotConfig);

      try {
        await screenshotBaker.screenshot();

        console.log(green(bold('The screenshot was a success!')));
      } catch (err) {
        console.log(
          red(bold("Screenshot failed. Here's what possibly went wrong:\n"))
        );
        logErrorMessage(err);
        process.exit(1);
      }
      break;
    case 'serve':
      await baker.serve();
  }
}

run(process.argv.slice(2)).catch((err) => {
  console.error(err);
  // we want to throw a real exit value on crash and burn
  process.exit(1);
});

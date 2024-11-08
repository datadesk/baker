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
      try {
        await baker.screenshots();

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

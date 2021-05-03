// native
import { join, parse, extname } from 'path';

// packages
import { rollup, watch } from 'rollup';
import { terser } from 'rollup-plugin-terser';
import { babel } from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import svelte from 'rollup-plugin-svelte';
import { importMetaAssets } from '@web/rollup-plugin-import-meta-assets';

// local
import { BaseEngine } from './base.js';
import { getEnvironment, isProductionEnv } from '../env.js';
import { dynamicImportPolyfillPlugin } from '../rollup-plugins/inject-dynamic-polyfill.js';
import { dataPlugin } from '../rollup-plugins/data-plugin.js';
import { datasetPlugin } from '../rollup-plugins/dataset-plugin.js';
import { cssPlugin } from '../rollup-plugins/css-plugin.js';
import { preprocess } from '../../svelte.config.js';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

export class RollupEngine extends BaseEngine {
  constructor({ entrypoints, ...args }) {
    super(args);

    this.name = 'rollup';

    // the path, array of paths or glob of where entrypoints can be found
    this.filePattern = entrypoints;

    // we only want to ignore node_modules, but shouldn't really matter
    this.ignorePattern = ['**/node_modules/**'];

    // by default scripts will get put into a scripts directory
    this.dir = join(this.output, this.staticRoot, 'scripts');

    this.context = {};
  }

  generateInput(entrypoints) {
    // keep track of every entrypoint we find
    const entrypointNames = new Set();

    const entries = {};

    for (const entrypoint of entrypoints) {
      const { name } = parse(entrypoint);

      if (entrypointNames.has(name)) {
        throw new Error(
          `Multiple JavaScript entrypoints are trying to use "${name}" as their identifier - each entrypoint must be unique. It's possible your "entrypoints" glob is too greedy and is finding more files than you expect.`
        );
      }

      // track that this name is in use
      entrypointNames.add(name);

      // add name to our input
      entries[name] = entrypoint;
    }

    return entries;
  }

  generateInputOptions(input, replaceValues) {
    // all valid input extensions
    const extensions = ['.js', '.jsx', '.mjs', '.ts', '.tsx'];

    // ensure everything has the same JSX Pragma
    const jsxPragma = 'h';

    const config = {
      input,
      plugins: [
        // this will replace any text that appears in JS with these values
        replace({
          preventAssignment: true,
          values: replaceValues,
        }),
        isProductionEnv &&
          dynamicImportPolyfillPlugin({
            base: this.pathPrefix,
            dir: join(this.staticRoot, 'scripts'),
          }),
        datasetPlugin(),
        dataPlugin(this.context),
        nodeResolve({ extensions }),
        commonjs(),
        json(),
        svelte({
          compilerOptions: { dev: !isProductionEnv },
          emitCss: true,
          preprocess,
        }),
        cssPlugin(),
        babel({
          babelHelpers: 'bundled',
          exclude: 'node_modules/**',
          extensions,
          presets: [
            isProductionEnv && [
              require.resolve('@babel/preset-env'),
              {
                targets: { esmodules: true },
                bugfixes: true,
                useBuiltIns: false,
              },
            ],
            [
              require.resolve('@babel/preset-typescript'),
              {
                jsxPragma,
                allowDeclareFields: true,
                onlyRemoveTypeImports: true,
              },
            ],
          ].filter(Boolean),
          plugins: [
            [
              require.resolve('@babel/plugin-transform-react-jsx'),
              {
                // we assume Preact is what you want, TODO to make configurable
                pragma: jsxPragma,
                pragmaFrag: 'Fragment',
              },
            ],
            require.resolve('babel-plugin-macros'),
          ],
        }),
        importMetaAssets(),
      ].filter(Boolean),
      preserveEntrySignatures: false,
      onwarn,
    };

    return config;
  }

  generateOutputOptions(dir) {
    // in production we hash the URLs
    const entryFileNames = isProductionEnv ? '[name].[hash].js' : '[name].js';
    const chunkFileNames = isProductionEnv
      ? '[name].[hash].chunk.js'
      : '[name].chunk.js';
    const assetFileNames = isProductionEnv
      ? 'assets/[name].[hash][extname]'
      : 'assets/[name][extname]';

    const dynamicImportFunction = isProductionEnv ? '__import__' : undefined;

    const options = {
      dir,
      entryFileNames,
      chunkFileNames,
      assetFileNames,
      format: 'esm',
      sourcemap: true,
      interop: 'auto',
      dynamicImportFunction,
      plugins: [
        isProductionEnv &&
          terser({
            ecma: 8,
            safari10: true,
          }),
      ].filter(Boolean),
    };

    return options;
  }

  async generateBundle(input, entrypoints, replaceValues) {
    // generate the Rollup inputOptions
    const inputOptions = this.generateInputOptions(input, replaceValues);

    // generate the Rollup outputOptions
    const outputOptions = this.generateOutputOptions(this.dir);

    // prepare the Rollup bundle
    const bundle = await rollup(inputOptions);

    // write out the files
    const info = await bundle.write(outputOptions);

    // prep the manifest object
    const manifest = {};

    // prep list of CSS
    const css = {};

    // collect the manifest
    for (const entrypoint of entrypoints) {
      const { name } = parse(entrypoint);

      const chunk = info.output.find(
        (chunk) => chunk.type === 'chunk' && entrypoint === chunk.facadeModuleId
      );

      if (chunk) {
        manifest[name] = join(this.staticRoot, 'scripts', chunk.fileName);

        const chunkCss = chunk.imports.find((p) => extname(p) === '.css');

        css[name] = chunkCss
          ? join(this.staticRoot, 'scripts', chunkCss)
          : null;
      }
    }

    const preloads = info.output
      .filter(({ isEntry }) => !isEntry)
      .map(({ fileName }) => join(this.staticRoot, 'scripts', fileName));

    return { manifest, preloads, css };
  }

  /**
   * Rollup has its own file output mechanism built-in, so it's easier to
   * sidestep BaseEngine.build and nudge Rollup in the right direction.
   */
  async build() {
    // find our entrypoints by tapping into BaseEngine.findFiles
    const entrypoints = await this.findFiles();

    // if there are no entrypoints no need to continue
    if (!entrypoints.length) return;

    // use our list of entrypoints to create the Rollup input
    const input = this.generateInput(entrypoints);

    // get our current environment for passing into the input bundle
    const { stringified: replaceValues } = getEnvironment(this.pathPrefix);

    // create the modern bundle
    const { manifest, preloads, css } = await this.generateBundle(
      input,
      entrypoints,
      replaceValues
    );

    // add the modern build to the manifest
    this.manifest = manifest;

    // add the generated CSS
    this.manifest.css = css;

    // add the preloads to the manifest
    this.manifest.preloads = preloads;
  }

  async watch(fn) {
    // find our entrypoints by tapping into BaseEngine.findFiles
    const entrypoints = await this.findFiles();

    // if there are no entrypoints no need to continue
    if (!entrypoints.length) return;

    // use our list of entrypoints to create the Rollup input
    const input = this.generateInput(entrypoints);

    // get our current environment for passing into the input bundle
    const { stringified: replaceValues } = getEnvironment(this.pathPrefix);

    // generate the Rollup inputOptions
    const inputOptions = this.generateInputOptions(input, replaceValues);

    // generate the Rollup outputOptions
    const outputOptions = this.generateOutputOptions(this.dir);

    // set up the Rollup watcher
    const watcher = watch({
      ...inputOptions,
      output: outputOptions,
    });

    // check a few events from a build
    watcher.on('event', (event) => {
      if (event.result) {
        event.result.close();
      }

      switch (event.code) {
        // if there's a normal error, add it to the list and share it out
        case 'ERROR':
          fn(event.error);
          break;
        // when the bundle ends, generate a new manifest
        case 'BUNDLE_END':
          fn(null, event.result);
          break;
      }
    });
  }
}

function onwarn(warning, onwarn) {
  if (
    warning.code === 'CIRCULAR_DEPENDENCY' &&
    /[/\\]d3-\w+[/\\]/.test(warning.message)
  ) {
    return;
  }

  onwarn(warning);
}

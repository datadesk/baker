// native
import { extname, join, parse } from 'path';

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
import { prependEntry } from '../rollup-plugins/prepend-entry.js';
import { dataPlugin } from '../rollup-plugins/data-plugin.js';
import { datasetPlugin } from '../rollup-plugins/dataset-plugin.js';
import { cssPlugin } from '../rollup-plugins/css-plugin.js';
import { polyfillsDynamicImport } from '../paths.js';
import * as svelteConfig from '../../svelte.config.js';

import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export class RollupEngine extends BaseEngine {

  constructor({ entrypoints, svelteCompilerOptions = {}, ...args }) {
    super(args);

    this.name = 'rollup';

    // the path, array of paths or glob of where entrypoints can be found
    this.filePattern = entrypoints;

    // we only want to ignore node_modules, but shouldn't really matter
    this.ignorePattern = ['**/node_modules/**'];

    // by default scripts will get put into a scripts directory
    this.dir = join(this.output, this.staticRoot, 'scripts');

    // any custom Svelte compiler options to pass along to rollup-plugin-svelte
    this.svelteCompilerOptions = svelteCompilerOptions;

    // internal tracking of Rollup's chunks for building the manifest and errors
    // for reporting out
    this._chunks = [];
    this._errors = [];

    this.context = {};
  }

  generateModernInput(entrypoints) {
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

  generateLegacyInput(entrypoint) {
    return [entrypoint];
  }

  generateInputOptions(input, replaceValues, nomodule = false) {
    // inline dynamic imports if we're in nomodule mode
    const inlineDynamicImports = nomodule;

    // all valid input extensions
    const extensions = ['.js', '.jsx', '.mjs', '.ts', '.tsx'];

    // ensure everything has the same JSX Pragma
    const jsxPragma = 'h';

    const content = isProductionEnv
      ? `import "${polyfillsDynamicImport}";\n`
      : `import "${require.resolve(
          'mini-sync/client'
        )}";\nimport "${polyfillsDynamicImport}";\n`;

    const config = {
      input,
      plugins: [
        !nomodule && prependEntry({ content }),
        // this will replace any text that appears in JS with these values
        replace({
          preventAssignment: true,
          values: { 'process.env.LEGACY_BUILD': nomodule, ...replaceValues },
        }),
        datasetPlugin(),
        dataPlugin(this.context),
        nodeResolve({ extensions }),
        commonjs(),
        json(),
        svelte({
          compilerOptions: {
            dev: !isProductionEnv,
            ...this.svelteCompilerOptions,
          },
          emitCss: true,
          preprocess: svelteConfig.preprocess,
        }),
        cssPlugin(),
        babel({
          babelHelpers: 'bundled',
          exclude: 'node_modules/**',
          extensions,
          presets: [
            [
              require.resolve('@babel/preset-env'),
              {
                corejs: nomodule ? 3 : false,
                exclude: [
                  'transform-regenerator',
                  'transform-async-to-generator',
                ],
                targets: nomodule
                  ? { browsers: 'defaults' }
                  : { esmodules: true },
                bugfixes: !nomodule,
                useBuiltIns: nomodule ? 'usage' : false,
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
            // only when we are not using modules (AKA no promises) do we
            // convert async-await like this
            nomodule && [
              require.resolve('babel-plugin-transform-async-to-promises'),
              { inlineHelpers: true },
            ],
            require.resolve('babel-plugin-macros'),
          ].filter(Boolean),
        }),
        importMetaAssets(),
        {
          name: '__internal__',
          renderChunk: (_, chunk) => {
            this._chunks.push(chunk);
          },
        },
      ].filter(Boolean),
      inlineDynamicImports,
      preserveEntrySignatures: false,
      onwarn,
    };

    return config;
  }

  generateOutputOptions({ dir, nomodule = false }) {
    // in production we hash the URLs
    const entryFileNames = isProductionEnv ? '[name].[hash].js' : '[name].js';
    const chunkFileNames = isProductionEnv
      ? '[name].[hash].chunk.js'
      : '[name].chunk.js';
    const assetFileNames = isProductionEnv
      ? 'assets/[name].[hash][extname]'
      : 'assets/[name][extname]';

    // in a modern build we use authentic ESM modules, otherwise an IIFE
    const format = nomodule ? 'iife' : 'esm';

    const dynamicImportFunction = nomodule ? undefined : '__import__';

    const options = {
      entryFileNames,
      chunkFileNames,
      assetFileNames,
      format,
      sourcemap: true,
      interop: 'auto',
      dynamicImportFunction,
      plugins: [
        isProductionEnv &&
          terser({
            ecma: nomodule ? 5 : 8,
            safari10: true,
          }),
      ].filter(Boolean),
    };

    options.dir = nomodule ? join(dir, 'nomodule') : dir;

    return options;
  }

  async generateBundle(input, entrypoints, replaceValues, nomodule = false) {
    // generate the Rollup inputOptions
    const inputOptions = this.generateInputOptions(
      input,
      replaceValues,
      nomodule
    );

    // generate the Rollup outputOptions
    const outputOptions = this.generateOutputOptions({
      dir: this.dir,
      nomodule,
    });

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
        manifest[name] = join(
          this.staticRoot,
          nomodule ? 'scripts/nomodule' : 'scripts',
          chunk.fileName
        );

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
    const modernInput = this.generateModernInput(entrypoints);

    // get our current environment for passing into the input bundle
    const { stringified: replaceValues } = getEnvironment(this.pathPrefix);

    // create the modern bundle
    const {
      manifest: modern,
      preloads,
      css,
    } = await this.generateBundle(modernInput, entrypoints, replaceValues);

    // add the modern build to the manifest
    this.manifest.modern = modern;

    // add the generated CSS
    this.manifest.css = css;

    // add the preloads to the manifest
    this.manifest.preloads = preloads;

    if (isProductionEnv) {
      // if we're in production, build the legacy build too
      this.manifest.legacy = {};

      for (const entrypoint of entrypoints) {
        const legacyInput = this.generateLegacyInput(entrypoint);

        const { manifest: legacy } = await this.generateBundle(
          legacyInput,
          entrypoints,
          replaceValues,
          true
        );

        Object.assign(this.manifest.legacy, legacy);
      }
    }
  }

  async watch(fn) {
    // find our entrypoints by tapping into BaseEngine.findFiles
    const entrypoints = await this.findFiles();

    // if there are no entrypoints no need to continue
    if (!entrypoints.length) return;

    // use our list of entrypoints to create the Rollup input
    const input = this.generateModernInput(entrypoints);

    // get our current environment for passing into the input bundle
    const { stringified: replaceValues } = getEnvironment(this.pathPrefix);

    // generate the Rollup inputOptions
    const inputOptions = this.generateInputOptions(input, replaceValues);

    // generate the Rollup outputOptions
    const outputOptions = this.generateOutputOptions({ dir: this.dir });

    // set up the Rollup watcher
    const watcher = watch({
      ...inputOptions,
      output: outputOptions,
    });

    // reset the tracking variables whenever the bundle changes
    watcher.on('change', () => {
      this._chunks = [];
      this._errors = [];
    });

    // check a few events from a build
    watcher.on('event', (event) => {
      switch (event.code) {
        // if there's a normal error, add it to the list and share it out
        case 'ERROR':
          this._errors.push(event.error);

          fn(this._errors);
          break;
        // when the bundle ends, generate a new manifest
        case 'BUNDLE_END':
          const manifest = {
            modern: {},
            legacy: {},
          };

          // collect the manifest
          for (const name of Object.keys(input)) {
            const chunk = this._chunks.find((chunk) => name in chunk.modules);

            if (chunk) {
              manifest.modern[name] = join(
                this.staticRoot,
                'scripts',
                chunk.fileName
              );
            }
          }

          fn(null, manifest);
          break;
      }
    });
  }
}

export function onwarn(warning, onwarn) {
  if (
    warning.code === 'CIRCULAR_DEPENDENCY' &&
    /[/\\]d3-\w+[/\\]/.test(warning.message)
  ) {
    return;
  }

  onwarn(warning);
}

// native
const path = require('path');

// packages
const { rollup, watch } = require('rollup');
const { terser } = require('rollup-plugin-terser');
const babel = require('rollup-plugin-babel');
const commonjs = require('rollup-plugin-commonjs');
const json = require('rollup-plugin-json');
const nodeResolve = require('rollup-plugin-node-resolve');
const replace = require('rollup-plugin-replace');

// local
const { BaseEngine } = require('./base');
const { isProductionEnv, nodeEnv } = require('../env');
const { concatEntry } = require('../concat-entry');
const { polyfillsLegacy, polyfillsModern } = require('../paths');

class RollupEngine extends BaseEngine {
  constructor({ entrypoints, ...args }) {
    super(args);

    // the path, array of paths or glob of where entrypoints can be found
    this.filePattern = entrypoints;

    // we only want to ignore node_modules, but shouldn't really matter
    this.ignorePattern = ['**/node_modules/**'];

    // by default scripts will get put into a scripts directory
    this.dir = path.join(this.output, 'scripts');

    // internal tracking of Rollup's chunks for building the manifest and errors
    // for reporting out
    this._chunks = [];
    this._errors = [];
  }

  generateModernInput(entrypoints) {
    // keep track of every entrypoint we find
    const entrypointNames = new Set();

    return entrypoints.reduce((entries, entrypoint) => {
      const { name } = path.parse(entrypoint);

      if (entrypointNames.has(name)) {
        throw new Error(
          `Multiple JavaScript entrypoints are trying to use "${name}" as their identifier - each entrypoint must be unique. It's possible your "entrypoints" glob is too greedy and is finding more files than you expect.`
        );
      }

      entrypointNames.add(name);

      entries[name] = [polyfillsModern, entrypoint];

      return entries;
    }, {});
  }

  generateLegacyInput(entrypoint) {
    return [polyfillsLegacy, entrypoint];
  }

  generateInputOptions(input, nomodule = false) {
    // if this is a nomodules build, assume the worst in terms of support
    const targets = nomodule ? { browsers: 'defaults' } : { esmodules: true };

    const config = {
      input,
      plugins: [
        concatEntry(),
        // this will replace any text that appears in JS with these values
        replace({
          'process.env.NODE_ENV': JSON.stringify(nodeEnv),
          'process.env.PATH_PREFIX': JSON.stringify(this.pathPrefix),
        }),
        nodeResolve(),
        commonjs(),
        json(),
        // isProductionEnv &&
        babel({
          exclude: 'node_modules/**',
          presets: [
            [
              require.resolve('@babel/preset-env'),
              {
                corejs: nomodule ? 3 : false,
                exclude: [
                  'transform-regenerator',
                  'transform-async-to-generator',
                ],
                targets,
                useBuiltIns: nomodule ? 'usage' : false,
              },
            ],
          ].filter(Boolean),
          plugins: [
            // only when we are not using modules (AKA no promises) do we
            // convert async-await like this
            nomodule && [
              require.resolve('babel-plugin-transform-async-to-promises'),
              { inlineHelpers: true },
            ],
          ].filter(Boolean),
        }),
        isProductionEnv && terser(),
        {
          name: '__internal__',
          renderChunk: (_, chunk) => {
            this._chunks.push(chunk);
          },
        },
      ].filter(Boolean),
      onwarn,
    };

    // if (!nomodule) {
    //   config.manualChunks = function manualChunks(id) {
    //     if (id.includes('node_modules')) {
    //       // The directory name following the last `node_modules`.
    //       // Usually this is the package, but it could also be the scope.
    //       const directories = id.split(path.sep);
    //       const name = directories[directories.lastIndexOf('node_modules') + 1];

    //       return name;
    //     }
    //   };
    // }

    return config;
  }

  generateOutputOptions({ dir, nomodule = false }) {
    // in production we hash the URLs
    const fileName = isProductionEnv ? '[name].[hash].js' : '[name].js';

    // in a modern build we use authentic ESM modules, otherwise an IIFE
    const format = nomodule ? 'iife' : 'esm';

    // inline dynamic imports if we're in nomodule mode
    const inlineDynamicImports = nomodule;

    const dynamicImportFunction = nomodule ? undefined : '__import__';

    const options = {
      entryFileNames: fileName,
      chunkFileNames: fileName,
      inlineDynamicImports,
      format,
      sourcemap: true,
      dynamicImportFunction,
    };

    options.dir = nomodule ? path.join(dir, 'nomodule') : dir;

    return options;
  }

  async generateModernBundle(input, entrypoints, nomodule = false) {
    // generate the Rollup inputOptions
    const inputOptions = this.generateInputOptions(input, nomodule);

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

    // collect the manifest
    for (const entrypoint of entrypoints) {
      const { name } = path.parse(entrypoint);
      const chunk = info.output.find(chunk => name === chunk.facadeModuleId);

      if (chunk) {
        manifest[name] = path.join(
          nomodule ? 'scripts/nomodule' : 'scripts',
          chunk.fileName
        );
      }
    }

    return manifest;
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

    // create the modern bundle
    const modern = await this.generateModernBundle(modernInput, entrypoints);

    // add the modern build to the manifest
    this.manifest.modern = modern;

    // if we're in production, build the legacy build too
    this.manifest.legacy = {};

    for (const entrypoint of entrypoints) {
      const legacyInput = this.generateLegacyInput(entrypoint);

      const legacy = await this.generateModernBundle(
        legacyInput,
        entrypoints,
        true
      );

      Object.assign(this.manifest.legacy, legacy);
    }
  }

  async watch(fn) {
    // find our entrypoints by tapping into BaseEngine.findFiles
    const entrypoints = await this.findFiles();

    // if there are no entrypoints no need to continue
    if (!entrypoints.length) return;

    // use our list of entrypoints to create the Rollup input
    const input = this.generateInput(entrypoints);

    // generate the Rollup inputOptions
    const inputOptions = this.generateInputOptions(input);

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
    watcher.on('event', event => {
      switch (event.code) {
        // if there's a fatal error, throw a big stink about it
        case 'FATAL':
          if (event.error.filename) {
            event.error.message = [
              `Failed to build — error in ${event.error.filename}: ${event.error.message}`,
              event.error.frame,
            ]
              .filter(Boolean)
              .join('\n');
          }

          fn(event.error);
          break;
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
            const chunk = this._chunks.find(chunk => name in chunk.modules);

            if (chunk) {
              manifest.modern[name] = path.join('scripts', chunk.fileName);
            }
          }

          fn(null, manifest);
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

module.exports = { RollupEngine };

// native
const path = require('path');

// packages
const fs = require('fs-extra');
const { rollup, watch } = require('rollup');
const babel = require('rollup-plugin-babel');
const commonjs = require('rollup-plugin-commonjs');
const json = require('rollup-plugin-json');
const nodeResolve = require('rollup-plugin-node-resolve');
const replace = require('rollup-plugin-replace');
const { terser } = require('rollup-plugin-terser');

// local
const { BaseEngine } = require('./base');
const { isProductionEnv, nodeEnv } = require('../env');
const { getRevHash } = require('../utils');

class RollupEngine extends BaseEngine {
  constructor({ entrypoints, ...args }) {
    super(args);

    // the path, array of paths or glob of where entrypoints can be found
    this.filePattern = entrypoints;

    // we only want to ignore node_modules, but shouldn't really matter
    this.ignorePattern = ['**/node_modules/**'];

    // internal tracking of Rollup's chunks and errors for building the manifest
    this._chunks = [];
    this._errors = [];
  }

  generateInputOptions(input, legacy = false) {
    return {
      input,
      plugins: [
        replace({
          'process.env.NODE_ENV': JSON.stringify(nodeEnv),
          'process.env.PATH_PREFIX': JSON.stringify(this.pathPrefix),
        }),
        nodeResolve(),
        commonjs(),
        json(),
        babel({
          extensions: ['.mjs', '.js'],
          runtimeHelpers: true,
          exclude: ['node_modules/**'],
          presets: [
            [
              require.resolve('@babel/preset-env'),
              {
                exclude: [
                  'transform-regenerator',
                  'transform-async-to-generator',
                ],
                targets: legacy ? 'defaults' : { esmodules: true },
              },
            ],
          ],
          plugins: [
            legacy && [
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
      experimentalOptimizeChunks: true,
    };
  }

  generateOutputOptions(dir, legacy) {
    const fileName = isProductionEnv ? '[name].[hash].js' : '[name].js';

    return {
      dir: legacy ? path.join(dir, 'legacy') : dir,
      entryFileNames: fileName,
      chunkFileNames: fileName,
      format: legacy ? 'system' : 'esm',
      sourcemap: true,
    };
  }

  /**
   * Rollup has its own file output mechanism built-in, so it's easier to
   * sidestep BaseEngine.build() and nudge Rollup in the right direction.
   */
  async build() {
    const dir = path.join(this.output, 'scripts');

    const entrypoints = await this.findFiles();

    if (!entrypoints.length) return;

    const entrypointNames = new Set();

    const input = entrypoints.reduce((acc, curr) => {
      const { name } = path.parse(curr);

      if (entrypointNames.has(name)) {
        throw new Error(
          `Multiple JavaScript entrypoints are trying to use "${name}" as their identifier - each entrypoint must be unique. It's possible your "entrypoints" glob is too greedy and is finding more files than you expect.`
        );
      }

      entrypointNames.add(name);

      acc[name] = curr;

      return acc;
    }, {});

    // modern bundle
    const modernInputOptions = this.generateInputOptions(input, false);
    const modernOutputOptions = this.generateOutputOptions(dir, false);
    const modernBundle = await rollup(modernInputOptions);
    const modernInfo = await modernBundle.write(modernOutputOptions);

    // legacy bundle
    const legacyInputOptions = this.generateInputOptions(input, true);
    const legacyOutputOptions = this.generateOutputOptions(dir, true);
    const legacyBundle = await rollup(legacyInputOptions);
    const legacyInfo = await legacyBundle.write(legacyOutputOptions);

    const manifest = {
      modern: {},
      legacy: {},
    };

    // collect the modern manifest
    for (const [name, file] of Object.entries(input)) {
      const chunk = modernInfo.output.find(chunk => file in chunk.modules);

      if (chunk) manifest.modern[name] = path.join('scripts', chunk.fileName);
    }

    // collect the legacy manifest
    for (const [name, file] of Object.entries(input)) {
      const chunk = legacyInfo.output.find(chunk => file in chunk.modules);

      if (chunk)
        manifest.legacy[name] = path.join('scripts/legacy', chunk.fileName);
    }

    // s.js depends on Promises to handle loading, so we need Promise support
    const promisePolyfill = await fs.readFile(
      require.resolve('promise-polyfill/dist/polyfill.min.js'),
      'utf8'
    );

    // the minimal SystemJS loader
    const moduleLoader = await fs.readFile(
      require.resolve('systemjs/dist/s.min.js'),
      'utf8'
    );

    // combine the promise polyfill with the SystemJS loader
    const loader = promisePolyfill.concat(moduleLoader);

    let loaderName;

    if (isProductionEnv) {
      const hash = await getRevHash(loader);
      loaderName = `legacy/loader.${hash}.js`;
    } else {
      loaderName = 'legacy/loader.js';
    }

    // combine them all into a loader script for legacy browsers
    await fs.outputFile(path.join(dir, loaderName), loader);

    manifest.loader = path.join('scripts', loaderName);

    this.manifest = manifest;
  }

  async watch(fn) {
    const dir = path.join(this.output, 'scripts');

    const entrypoints = await this.findFiles();

    const input = entrypoints.reduce((acc, curr) => {
      const { name } = path.parse(curr);

      acc[name] = curr;

      return acc;
    }, {});

    const inputOptions = this.generateInputOptions(input, false);
    const output = this.generateOutputOptions(dir, false);

    const watcher = watch({
      ...inputOptions,
      output,
    });

    watcher.on('change', () => {
      this._chunks = [];
      this._errors = [];
    });

    watcher.on('event', event => {
      switch (event.code) {
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
        case 'ERROR':
          this._errors.push(event.error);

          fn(this._errors);
          break;
        case 'BUNDLE_END':
          const manifest = {
            modern: {},
            legacy: {},
          };

          // collect the modern manifest
          for (const [name, file] of Object.entries(input)) {
            const chunk = this._chunks.find(chunk => file in chunk.modules);

            if (chunk)
              manifest.modern[name] = path.join('scripts', chunk.fileName);
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

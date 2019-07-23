// native
const path = require('path');

// packages
const fs = require('fs-extra');
const { rollup, watch } = require('rollup');
const babel = require('rollup-plugin-babel');
const commonjs = require('rollup-plugin-commonjs');
const nodeResolve = require('rollup-plugin-node-resolve');
const replace = require('rollup-plugin-replace');
const { terser } = require('rollup-plugin-terser');

// local
const { BaseEngine } = require('./base');
const { isProductionEnv, nodeEnv } = require('../env');

class RollupEngine extends BaseEngine {
  constructor({ entrypoints, ...args }) {
    super(args);

    this.filePattern = path.join(entrypoints, '*.{js,mjs}');

    this.ignorePattern = ['**/node_modules/**'];

    this.chunks = [];
    this.errors = [];
  }

  generateInputOptions(input, legacy = false) {
    return {
      input,
      plugins: [
        replace({ 'process.env.NODE_ENV': JSON.stringify(nodeEnv) }),
        nodeResolve(),
        commonjs(),
        babel({
          extensions: ['.mjs', '.js'],
          runtimeHelpers: true,
          exclude: ['node_modules/@babel/**'],
          presets: [
            [
              require.resolve('@babel/preset-env'),
              {
                targets: legacy ? 'defaults' : { esmodules: true },
              },
            ],
          ],
          plugins: [
            [
              require.resolve('@babel/plugin-transform-runtime'),
              {
                useESModules: true,
              },
            ],
          ],
        }),
        isProductionEnv && terser(),
        {
          name: '__internal__',
          renderChunk: (_, chunk) => {
            this.chunks.push(chunk);
          },
        },
      ].filter(Boolean),
      experimentalOptimizeChunks: true,
    };
  }

  generateOutputOptions(dir, legacy) {
    const fileName = isProductionEnv ? '[name].[hash].js' : '[name].js';

    return {
      dir: legacy ? path.join(dir, 'legacy') : dir,
      entryFileNames: fileName,
      chunkFileNames: fileName,
      format: legacy ? 'system' : 'es',
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

    const input = entrypoints.reduce((acc, curr) => {
      const { name } = path.parse(curr);

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
    const loader = await fs.readFile(
      require.resolve('systemjs/dist/s.min.js'),
      'utf8'
    );

    // combine them all into a loader script for legacy browsers
    await fs.outputFile(
      path.join(dir, 'legacy/loader.js'),
      promisePolyfill.concat(loader)
    );

    manifest.loader = 'scripts/legacy/loader.js';

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
      this.chunks = [];
      this.errors = [];
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
          this.errors.push(event.error);

          fn(this.errors);
          break;
        case 'BUNDLE_END':
          const manifest = {
            modern: {},
            legacy: {},
          };

          // collect the modern manifest
          for (const [name, file] of Object.entries(input)) {
            const chunk = this.chunks.find(chunk => file in chunk.modules);

            if (chunk)
              manifest.modern[name] = path.join('scripts', chunk.fileName);
          }

          fn(null, manifest);
          break;
      }
    });
  }
}

module.exports = { RollupEngine };

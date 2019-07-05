// native
const path = require('path');

// packages
const fs = require('fs-extra');
const { rollup } = require('rollup');
const babel = require('rollup-plugin-babel');
const commonjs = require('rollup-plugin-commonjs');
const nodeResolve = require('rollup-plugin-node-resolve');
const replace = require('rollup-plugin-replace');
const { terser } = require('rollup-plugin-terser');

// local
const { BaseEngine } = require('./base');
const { isProductionEnv, nodeEnv } = require('../env');

class RollupEngine extends BaseEngine {
  constructor({ input, output }) {
    super({ input, output });

    // the extensions this engine uses
    this.extensions = ['js', 'mjs'];

    // the file prefix to look for
    this.filePrefix = 'entry-';

    // saves a reference to Rollup's cache
    this.__cache__ = null;
  }

  generateInputOptions(input, legacy = false) {
    return {
      input,
      cache: this.__cache__,
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
      ].filter(Boolean),
      experimentalOptimizeChunks: true,
    };
  }

  generateOutputOptions(dir, legacy) {
    return {
      dir: legacy ? path.join(dir, 'legacy') : dir,
      entryFileNames: '[name]-[hash].js',
      chunkFileNames: '[name]-[hash].js',
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

    const entrypoints = await this.findFiles({
      ignore: ['**/_*/**', '**/_*', '**/node_modules/**'],
    });

    if (!entrypoints.length) return;

    const input = entrypoints.reduce((acc, curr) => {
      const { name } = path.parse(curr);

      acc[name.split(this.filePrefix)[1]] = curr;

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

    // s.js uses this, so we have to polyfill it
    const stringEndsWithPolyfill =
      'String.prototype.endsWith||(String.prototype.endsWith=function(t,n){return(void 0===n||n>this.length)&&(n=this.length),this.substring(n-t.length,n)===t})\n';

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
      stringEndsWithPolyfill.concat(promisePolyfill, loader)
    );

    manifest.loader = 'scripts/legacy/loader.js';
    return manifest;
  }
}

module.exports = { RollupEngine };

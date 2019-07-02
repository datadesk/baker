// native
const path = require('path');

// packages
const fs = require('fs-extra');
const { rollup } = require('rollup');
const babel = require('rollup-plugin-babel');
const commonjs = require('rollup-plugin-commonjs');
const nodeResolve = require('rollup-plugin-node-resolve');
const { terser } = require('rollup-plugin-terser');

// local
const { BaseEngine } = require('./base');
const { isProductionEnv } = require('../env');

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

  /**
   * Rollup has its own file output mechanism built-in, so it's easier to just
   * sidestep our BaseEngine.build() and nudge Rollup into the right
   * directions.
   */
  async build() {
    const entrypoints = await this.findFiles({
      ignore: ['**/_*/**', '**/_*', '**/node_modules/**'],
    });

    const input = entrypoints.reduce((acc, curr) => {
      const { name } = path.parse(curr);

      acc[name.split(this.filePrefix)[1]] = curr;

      return acc;
    }, {});

    const inputOptions = {
      input,
      cache: this.__cache__,
      plugins: [
        nodeResolve({ extensions: ['.mjs', '.js'] }),
        commonjs(),
        babel({
          extensions: ['.mjs', '.js'],
          runtimeHelpers: true,
          exclude: ['node_modules/@babel/**'],
          presets: [
            [
              require.resolve('@babel/preset-env'),
              { targets: { esmodules: true } },
            ],
          ],
          plugins: [
            require.resolve('@babel/plugin-syntax-dynamic-import'),
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

    const dir = path.join(this.output, 'scripts');
    const legacyDir = path.join(dir, 'legacy');

    const outputs = [
      {
        dir,
        entryFileNames: '[name]-[hash].js',
        chunkFileNames: '[name]-[hash].js',
        format: 'es',
        sourcemap: true,
      },
      {
        dir: legacyDir,
        entryFileNames: '[name]-[hash].js',
        chunkFileNames: '[name]-[hash].js',
        format: 'system',
        sourcemap: true,
      },
    ];

    const bundle = await rollup(inputOptions);

    // store the cache object from previous builds
    this.__cache__ = bundle.cache;

    const chunks = [];

    for await (const output of outputs) {
      const info = await bundle.write(output);
      console.log(info);

      chunks.push(...info.output);
    }

    const manifest = {};

    for (const [name, file] of Object.entries(input)) {
      const chunk = chunks.find(chunk => file in chunk.modules);

      if (chunk) manifest[name] = path.join('scripts', chunk.fileName);
    }

    await fs.copy(
      require.resolve('systemjs/dist/s.min.js'),
      path.join(legacyDir, 'loader.js')
    );

    return manifest;
  }
}

module.exports = { RollupEngine };

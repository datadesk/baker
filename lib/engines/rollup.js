// native
const path = require('path');

// packages
const { rollup } = require('rollup');
const nodeResolve = require('rollup-plugin-node-resolve');
const { terser } = require('rollup-plugin-terser');

// local
const { BaseEngine } = require('./base');

class RollupEngine extends BaseEngine {
  constructor({ input, output }) {
    super({ input, output });

    // the extensions this engine uses
    this.extensions = ['js', 'mjs'];

    // the file prefix to look for
    this.filePrefix = 'entry-';

    // saves a reference to Rollup's cache
    this.cache = null;
  }

  async render(entrypoints) {
    const input = entrypoints.reduce((acc, curr) => {
      const { name } = path.parse(curr);

      acc[name.split(this.filePrefix)[1]] = curr;

      return acc;
    }, {});

    const inputOptions = {
      input,
      cache: this.cache,
      plugins: [nodeResolve()],
      experimentalOptimizeChunks: true,
    };

    const outputs = [
      {
        dir: this.output,
        entryFileNames: '[name]/entry-[hash].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        format: 'es',
        sourcemap: true,
      },
    ];

    const bundle = await rollup(inputOptions);

    // store the cache object from previous builds
    this.cache = bundle.cache;

    for (const output of outputs) {
      const results = await bundle.write(output);
      console.log(results);
    }
  }

  async publish() {
    const files = await this.findFiles();

    await this.render(files);
  }
}

module.exports = { RollupEngine };

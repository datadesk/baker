// native
const path = require('path');

// packages
const fs = require('fs-extra');
const glob = require('fast-glob');

/**
 * The base builder engine for all asset types.
 */
class BaseEngine {
  constructor({ input, output }) {
    // the input directory
    this.input = input;

    // the output directory
    this.output = output;

    // the optional file prefix to look for
    this.filePrefix = '';
  }

  async findFiles({
    ignore = ['**/_*/**', '**/_*', '**/node_modules/**'],
  } = {}) {
    const files = await glob(
      path.join(
        this.input,
        `**/${this.filePrefix}*.{${this.extensions.join(',')}}`
      ),
      { ignore }
    );

    return files;
  }

  async build(args) {
    const files = await this.findFiles();

    const manifest = {};

    for await (const file of files) {
      // render this file according to the engine
      const content = await this.render(file, args);

      // grab the path relative to the source directory
      const input = path.relative(this.input, file);

      // pull the relative path's extension and name
      const parts = path.parse(input);

      // use the inheriting engine's instructions for generating the output path
      const output = await this.getOutputPath({ content, input, ...parts });

      // build the absolute output path
      const absolute = path.join(this.output, output);

      // write to disk
      await fs.outputFile(absolute, content);

      // save a reference how the file path was modified
      manifest[input] = output;
    }

    return manifest;
  }
}

module.exports = { BaseEngine };

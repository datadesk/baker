// native
const path = require('path');

// packages
const glob = require('fast-glob');

class BaseEngine {
  constructor({ input, output }) {
    // the input directory
    this.input = input;

    // the output directory
    this.output = output;

    // the file prefix to look for, we default to empty string
    this.filePrefix = '';
  }

  async findFiles() {
    const files = await glob(
      path.join(
        this.input,
        `**/${this.filePrefix}*.{${this.extensions.join(',')}}`
      ),
      { ignore: '**/_*' }
    );

    return files;
  }
}

module.exports = { BaseEngine };

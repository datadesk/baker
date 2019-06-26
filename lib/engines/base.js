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
  }

  async findFiles() {
    const files = await glob(
      path.join(this.input, `**/*.{${this.extensions.join(',')}}`),
      { ignore: '**/_*' }
    );

    return files;
  }
}

module.exports = { BaseEngine };

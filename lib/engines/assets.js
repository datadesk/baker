// native
const path = require('path');

// packages
const fs = require('fs-extra');
const imagemin = require('imagemin');
const gifsicle = require('imagemin-gifsicle');
const jpegtran = require('imagemin-jpegtran');
const optipng = require('imagemin-optipng');
const svgo = require('imagemin-svgo');

// local
const { BaseEngine } = require('./base');
const { isProductionEnv } = require('../env');
const { getRevHash, validImageExtensions } = require('../utils');

class AssetsEngine extends BaseEngine {
  constructor({ dir, ...args }) {
    super(args);

    // the directory where all assets live
    this.dir = path.relative(this.input, dir);

    // the glob for finding asset files, we accept anything
    this.filePattern = path.join(this.dir, '**/*');

    // prepare the plugins for image processing
    this.plugins = [gifsicle(), jpegtran(), optipng(), svgo()];
  }

  async getOutputPath({ content, dir, ext, name }) {
    // if we're in production and this is an image, hash it, otherwise skip
    if (isProductionEnv && validImageExtensions.includes(ext)) {
      const hash = await getRevHash(content);
      name = `${name}.${hash}`;
    }

    return path.format({ dir, name, ext });
  }

  async render(file) {
    // read the file
    let buffer = await fs.readFile(file);

    // determine the file's extension
    const { ext } = path.parse(file);

    // if this is an image, we want to do extra work
    if (validImageExtensions.includes(ext)) {
      // pass it through imagemin
      buffer = await imagemin.buffer(buffer, { plugins: this.plugins });
    }

    this.addDependency(file);

    return buffer;
  }
}

module.exports = { AssetsEngine };

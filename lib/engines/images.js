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
const { getRevHash } = require('../utils');

class ImagesEngine extends BaseEngine {
  constructor({ ...args }) {
    super(args);

    this.filePattern = '**/*.{gif,jpeg,jpg,png,svg}';

    // prepare the plugins for image processing
    this.plugins = [gifsicle(), jpegtran(), optipng(), svgo()];
  }

  async getOutputPath({ content, dir, ext, name }) {
    if (isProductionEnv) {
      const hash = await getRevHash(content);
      name = `${name}.${hash}`;
    }

    return path.format({ dir, name, ext });
  }

  async render(file) {
    // read the image
    const buffer = await fs.readFile(file);

    // pass it through imagemin
    const image = await imagemin.buffer(buffer, { plugins: this.plugins });

    return image;
  }
}

module.exports = { ImagesEngine };

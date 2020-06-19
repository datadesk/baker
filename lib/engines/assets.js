// native
const fs = require('fs').promises;
const path = require('path');

// packages
const imagemin = require('imagemin');
const gifsicle = require('imagemin-gifsicle');
const jpegtran = require('imagemin-jpegtran');
const optipng = require('imagemin-optipng');
const svgo = require('imagemin-svgo');

// local
const { BaseEngine } = require('./base');
const { isProductionEnv } = require('../env');
const {
  getRevHash,
  validFontExtensions,
  validImageExtensions,
  validJsonExtensions,
  validVideoExtensions,
} = require('../utils');

class AssetsEngine extends BaseEngine {
  constructor({ dir, ...args }) {
    super(args);

    // the directory where all assets live
    this.dir = path.relative(this.input, dir);

    // the glob for finding asset files, we accept anything
    this.filePattern = path.join(this.dir, '**/*');

    // prepare the plugins for image processing
    this.plugins = [gifsicle(), jpegtran(), optipng(), svgo()];

    // the set of valid extensions to hash
    this.validExtensions = new Set([
      ...validFontExtensions,
      ...validImageExtensions,
      ...validJsonExtensions,
      ...validVideoExtensions,
    ]);
  }

  async getOutputPath({ content, dir, ext, name }) {
    // ensure our check picks up extensions with different cases
    const normalizedExt = ext.toLowerCase();

    // if we're in production and this is an image, font, video or JSON, hash it, otherwise skip
    if (isProductionEnv && this.validExtensions.has(normalizedExt)) {
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

    const normalizedExt = ext.toLowerCase();

    // if this is an image, we want to do extra work
    if (isProductionEnv && validImageExtensions.includes(normalizedExt)) {
      // pass it through imagemin
      buffer = await imagemin.buffer(buffer, { plugins: this.plugins });
    }

    // if this is JSON, we want to minify it
    if (isProductionEnv && validJsonExtensions.includes(normalizedExt)) {
      buffer = Buffer.from(JSON.stringify(JSON.parse(buffer.toString())));
    }

    this.addDependency(file);

    return buffer;
  }
}

module.exports = { AssetsEngine };

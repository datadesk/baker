// native
import { promises as fs } from 'fs';
import { format, join, parse, relative } from 'path';

// packages
import debug from 'debug';
import imagemin from 'imagemin';
import gifsicle from 'imagemin-gifsicle';
import jpegtran from 'imagemin-jpegtran';
import optipng from 'imagemin-optipng';
import svgo from 'imagemin-svgo';

// local
import { BaseEngine } from './base.js';
import { isProductionEnv } from '../env.js';
import {
  getRevHash,
  validAudioExtensions,
  validFontExtensions,
  validImageExtensions,
  validJsonExtensions,
  validVideoExtensions,
} from '../utils.js';

const logger = debug('baker:engines:assets');

export class AssetsEngine extends BaseEngine {
  constructor({ dir, ...args }) {
    super(args);

    this.name = 'assets';

    // the directory where all assets live
    this.dir = relative(this.input, dir);

    // the glob for finding asset files, we accept anything
    this.filePattern = join(this.dir, '**/*');

    // prepare the plugins for image processing
    this.plugins = [gifsicle(), jpegtran(), optipng(), svgo()];

    // the set of valid extensions to hash
    this.validExtensions = new Set([
      ...validFontExtensions,
      ...validImageExtensions,
      ...validJsonExtensions,
      ...validVideoExtensions,
      ...validAudioExtensions,
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

    return format({ dir, name, ext });
  }

  async render(file) {
    // grab the path relative to the source directory
    const input = relative(this.input, file);
    logger('loading', input);

    // determine the file's extension
    const { ext } = parse(file);

    // make sure it's always lowercase for matching purposes
    const normalizedExt = ext.toLowerCase();

    // read the file
    let buffer = await fs.readFile(file);

    // if this is an image, we want to do extra work
    if (isProductionEnv && validImageExtensions.includes(normalizedExt)) {
      // pass it through imagemin
      buffer = await imagemin.buffer(buffer, { plugins: this.plugins });
    }

    // if this is JSON, we want to minify it
    if (isProductionEnv && validJsonExtensions.includes(normalizedExt)) {
      buffer = Buffer.from(JSON.stringify(JSON.parse(buffer.toString())));
    }

    logger('finished processing of', input);

    return buffer;
  }

  /**
   * @param {string[]} files
   */
  buildManifest(files) {
    return files.reduce((obj, file) => {
      // grab the path relative to the source directory
      const input = relative(this.input, file);

      logger('found asset', input);

      obj[input] = input;

      return obj;
    }, {});
  }

  async build() {
    // clear out the dependencies and manifest
    this.invalidate();

    // find the files to work with
    const files = await this.findFiles();

    for (const file of files) {
      this.addDependency(file, file);
    }

    if (isProductionEnv) {
      try {
        await Promise.all(files.map((file) => this.outputFile(file)));
      } catch (err) {
        throw err;
      }
    } else {
      this.manifest = this.buildManifest(files);
    }
  }
}

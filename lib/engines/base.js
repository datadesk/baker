// native
const path = require('path');

// packages
const chokidar = require('chokidar');
const debounce = require('lodash.debounce');
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

    // the glob pattern to use for finding files to process
    this.filePattern = null;

    // an optional additional glob pattern to use only for file watching
    this.watchFilePattern = null;

    // any files or paths to ignore when searching
    this.ignorePattern = ['**/_*/**', '**/node_modules/**'];
  }

  findFiles() {
    return glob(path.join(this.input, this.filePattern), {
      ignore: this.ignorePattern,
    });
  }

  async build(args) {
    const files = await this.findFiles();

    const manifest = {};

    try {
      await Promise.all(
        files.map(async file => {
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
        })
      );
      return manifest;
    } catch (err) {
      throw err;
    }
  }

  watch(fn) {
    const watcher = chokidar.watch(
      path.join(this.input, this.watchFilePattern || this.filePattern),
      {
        ignored: this.ignorePattern,
      }
    );

    const onChange = debounce(fn, 200);

    ['add', 'change', 'unlink'].forEach(event => {
      watcher.on(event, onChange);
    });
  }
}

module.exports = { BaseEngine };

// native
const path = require('path');

// packages
const chokidar = require('chokidar');
const debounce = require('lodash.debounce');
const fs = require('fs-extra');
const glob = require('fast-glob');

// local
const { noop } = require('../utils');

/**
 * The base builder engine for all asset types. For most engines this will
 * handle the majority of tasks.
 */
class BaseEngine {
  /**
   * @param {object} options
   * @param {string} options.domain
   * @param {string} options.input
   * @param {string} options.output
   * @param {string} options.pathPrefix
   */
  constructor({ domain, input, output, pathPrefix }) {
    // the project's domain
    this.domain = domain;

    // the input directory
    this.input = input;

    // the output directory
    this.output = output;

    // the path prefix
    this.pathPrefix = pathPrefix;

    // the glob pattern to use for finding files to process
    this.filePattern = null;

    // an optional additional glob pattern for file watching
    this.watchFilePattern = null;

    // any files or paths to ignore when searching
    this.ignorePattern = ['**/_*/**', '**/node_modules/**'];

    // an optional separate watch pattern for ignoring during watching
    this.watchIgnorePattern = null;

    // the output manifest for this engine
    this.manifest = {};

    // any files this engine considers a dependency for rendering its output
    this.dependencies = new Set();
  }

  findFiles() {
    return glob(path.join(this.input, this.filePattern), {
      ignore: this.ignorePattern,
    });
  }

  addDependency(file) {
    this.dependencies.add(file);
  }

  getDependencies() {
    return Array.from(this.dependencies);
  }

  invalidate() {
    this.manifest = {};
    this.dependencies.clear();
  }

  getOutputPath({ dir, ext, name }) {
    return path.format({ dir, ext, name });
  }

  async build(args) {
    // clear out the dependencies and manifest
    this.invalidate();

    // find the files to work with
    const files = await this.findFiles();

    try {
      await Promise.all(
        files.map(async file => {
          // grab the path relative to the source directory
          const input = path.relative(this.input, file);

          // pull the relative path's extension and name
          const parts = path.parse(input);

          // render this file according to the engine
          const content = await this.render(file, args);

          // use the inheriting engine's instructions for generating the output path
          const output = await this.getOutputPath({ content, input, ...parts });

          // build the absolute output path
          const absolute = path.join(this.output, output);

          // write to disk
          await fs.outputFile(absolute, content);

          // save a reference how the file path was modified
          this.manifest[input] = output;
        })
      );
    } catch (err) {
      throw err;
    }
  }

  /**
   * A wrapper around chokidar to serve as our default watcher for any given
   * file type.
   *
   * @param {Function} [fn] The function to call every time a change is detected
   */
  watch(fn = noop) {
    // if we have a special watch pattern, use that instead
    const pattern = this.watchFilePattern || this.filePattern;

    // account for the case that something passes an array
    const toWatch = Array.isArray(pattern)
      ? pattern.map(s => path.resolve(this.input, s))
      : path.resolve(this.input, pattern);

    this.watcher = chokidar.watch(toWatch, {
      ignored: this.watchIgnorePattern || this.ignorePattern,
      ignoreInitial: true,
    });

    const onChange = debounce(async () => {
      try {
        const results = await this.build();

        fn(null, results);
      } catch (err) {
        fn(err);
      }
    }, 200);

    ['add', 'change', 'unlink'].forEach(event => {
      this.watcher.on(event, onChange);
    });
  }
}

module.exports = { BaseEngine };

// native
import * as path from 'path';

// packages
import chokidar from 'chokidar';
import debounce from 'lodash.debounce';
import * as fs from 'fs-extra';
import glob from 'fast-glob';

// local
import { noop } from '../utils';

interface Manifest {
  [key: string]: string;
}

/**
 * The base builder engine for all asset types. For most engines this will
 * handle the majority of tasks.
 */
export class Engine {
  input: string;
  output: string;
  filePattern: string;
  watchFilePattern: string;
  ignorePattern: string[];
  manifest: Manifest;
  dependencies: Set<string>;

  constructor({ input, output }: { input: string; output: string }) {
    // the input directory
    this.input = input;

    // the output directory
    this.output = output;

    // the glob pattern to use for finding files to process
    this.filePattern = null;

    // an optional additional glob pattern for file watching
    this.watchFilePattern = null;

    // any files or paths to ignore when searching
    this.ignorePattern = ['**/_*/**', '**/node_modules/**'];

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

  /**
   * Add a file to the dependency tracker for this Engine.
   *
   * @param file The file to add to the dependency tracker
   */
  addDependency(file: string) {
    this.dependencies.add(file);
  }

  /**
   * Get all the unique dependencies for this Engine as an array.
   */
  getDependencies() {
    return Array.from(this.dependencies);
  }

  /**
   * Clear out the manifest and dependencies on this Engine.
   */
  invalidate() {
    this.manifest = {};
    this.dependencies.clear();
  }

  async build(args: any) {
    // clear out the dependencies and manifest
    this.invalidate();

    // find the files to work with
    const files = await this.findFiles();

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

    const watcher = chokidar.watch(toWatch, {
      ignored: this.ignorePattern,
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
      watcher.on(event, onChange);
    });
  }
}

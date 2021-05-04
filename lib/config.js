// native
import { resolve } from 'path';

// packages
import { config as dotenv } from 'dotenv';
import dotenvExpand from 'dotenv-expand';

/**
 * Cleans up the user inputted options.
 *
 * @param {import('./types').BakerOptions} raw
 * @param {"build" | "serve"} command
 * @param {import('./types').BakerMode} [mode="development"]
 */
export function prepareConfig(raw, command, mode = 'development') {
  // set our NODE_ENV for any other tools that may depend on it
  process.env.NODE_ENV = mode;

  // the input directory of this baker
  const input = resolve(raw.input);

  // load the dotfile if it exists
  dotenvExpand(dotenv({ path: resolve(input, '.env') }));

  // where we will be outputting processed files
  const output = resolve(input, raw.output);

  // a special directory of files that should be considered extendable templates
  const layouts = resolve(input, raw.layouts);

  // a special directory where data files for passing to templates are loaded
  const data = resolve(input, raw.data);

  // a path prefix that should be applied where needed to static asset paths
  // to prep for deploy, ensures there's a leading slash
  const pathPrefix = resolve('/', raw.pathPrefix);

  // the likely location of the local node_modules directory
  const nodeModules = resolve(process.cwd(), 'node_modules');

  const config = {
    command,
    data,
    input,
    layouts,
    mode,
    nodeModules,
    output,
    pathPrefix,
  };

  // our prepared config
  return {
    ...raw,
    ...config,
  };
}

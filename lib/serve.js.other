// packages
import { premove } from 'premove/sync';

// local
import { prepareConfig } from './config.js';

/**
 * @param {import("./types").BakerOptions} userConfig
 */
export async function createServer(userConfig) {
  const config = prepareConfig(userConfig, 'serve', 'development');

  // remove the output directory to make sure it's clean
  premove(config.output);

  console.log(config);
}

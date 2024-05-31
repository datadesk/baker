import { join } from 'path';

const VALID_NODE_ENVS = ['development', 'production'];
const DEFAULT_NODE_ENV = 'production';

const DEBUG = process.env.DEBUG;
const NODE_ENV = process.env.NODE_ENV;
const BAKER_PATH_PREFIX = process.env.BAKER_PATH_PREFIX;

export const nodeEnv =
  NODE_ENV && VALID_NODE_ENVS.includes(NODE_ENV) ? NODE_ENV : DEFAULT_NODE_ENV;
export const isProductionEnv = nodeEnv === 'production';

export const inDebugMode = Boolean(DEBUG);

/**
 * Regex for grabbing any environmental variables that may start with "BAKER_".
 * @type {RegExp}
 */
const BAKER_REGEX = /^BAKER_/i;

/**
 * @param {string} pathPrefix
 */
export function getEnvironment(pathPrefix) {
  // find all the keys of the environment
  const keys = Object.keys(process.env);

  // find any of them that match our regex for BAKER_ exclusive ones
  const bakerKeys = keys.filter((key) => BAKER_REGEX.test(key));

  // build the object of environment variables
  const raw = bakerKeys.reduce(
    (env, key) => {
      env[key] = process.env[key];
      return env;
    },
    {
      // Are we in production mode or not?
      NODE_ENV: nodeEnv,
      // Useful for resolving the correct path relative to the project files
      PATH_PREFIX: pathPrefix,
    }
  );

  // Stringify all values so we can pass it directly to rollup-plugin-replace
  const stringified = Object.keys(raw).reduce((env, key) => {
    env[`process.env.${key}`] = JSON.stringify(raw[key]);
    return env;
  }, {});

  return { raw, stringified };
}

/**
 * Returns the path prefix for the project.
 *
 * @param projectName
 * @returns {string|string}
 */
export function bakerPathPrefix(projectName) {
  const localPathPrefix = join(projectName, '_dist');
  return BAKER_PATH_PREFIX || localPathPrefix;
}

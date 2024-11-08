import { resolve } from 'path';

const VALID_NODE_ENVS = ['development', 'production'];
const DEFAULT_NODE_ENV = 'production';

const DEBUG = process.env.DEBUG;
const NODE_ENV = process.env.NODE_ENV;

export const nodeEnv =
  NODE_ENV && VALID_NODE_ENVS.includes(NODE_ENV) ? NODE_ENV : DEFAULT_NODE_ENV;
export const isProductionEnv = nodeEnv === 'production';

export const inDebugMode = Boolean(DEBUG);

const BAKER_PREFIX = 'BAKER_';

/**
 * @param {string} pathPrefix
 */
export function getEnvironment(pathPrefix) {
  // find all the keys of the environment
  const keys = Object.keys(process.env);

  // find any of them that match our regex for BAKER_ exclusive ones
  const bakerKeys = keys.filter((key) => key.startsWith(BAKER_PREFIX));

  // build the object of environment variables
  const vars = bakerKeys.reduce(
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
  const replaceValues = Object.keys(vars).reduce((env, key) => {
    env[`process.env.${key}`] = JSON.stringify(vars[key]);
    return env;
  }, {});

  return { vars, replaceValues };
}

export function getBasePath(domain, pathPrefix) {
  // Local can use relative paths
  if (!isProductionEnv) return '/';

  if (!domain) {
    console.warn('WARNING: `domain` is missing from Baker config. Outputs from this project will not be embeddable in external pages/apps.');
    return resolve('/', pathPrefix);
  }

  // Dev and Prod deployments need to use absolute paths
  let basePath = new URL(pathPrefix, domain).toString();
  if (!basePath.endsWith('/')) {
    basePath = `${basePath}/`;
  }

  return basePath;
}

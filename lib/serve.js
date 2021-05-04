// native
import { extname } from 'path';

// packages
import autoprefixer from 'autoprefixer';
import * as journalize from 'journalize';
import { create } from 'mini-sync';
import postcssFlexbugsFixes from 'postcss-flexbugs-fixes';
import { premove } from 'premove';

// local
import { prepareConfig } from './config.js';
import { NunjucksEngine } from './engines/nunjucks.js';
import { RollupEngine } from './engines/rollup.js';

// filters
import * as bakerFilters from './filters.js';

// tags
import { createAssetTag } from './tags/asset.js';
import { createScriptTag } from './tags/script.js';
import { createStyleTag } from './tags/style.js';

// postcss plugins
import { staticUrlPlugin } from './postcss-plugins/static-url.js';

/**
 * @param {import("./types").BakerOptions} config
 */
export async function createServer(userConfig) {
  const {
    data,
    domain,
    entrypoints,
    input,
    layouts,
    nodeModules,
    nunjucks,
    output,
    pathPrefix,
    staticRoot,
  } = prepareConfig(userConfig, 'serve', 'development');

  // the default input and output arguments passed to each engine
  const defaults = {
    domain,
    input,
    output,
    pathPrefix,
    staticRoot,
  };

  const rollupEngine = new RollupEngine({ entrypoints, ...defaults });

  const nunjucksEngine = new NunjucksEngine({
    layouts,
    // createPages,
    ...defaults,
  });

  // prep the server instance
  const server = create({
    dir: [output, input],
    port: 3000,
  });

  // add all the features of journalize to nunjucks as filters
  nunjucksEngine.addCustomFilters({ ...journalize, ...bakerFilters });

  // additional custom filters
  nunjucksEngine.addCustomFilters({
    date: dateFilter,
    log: logFilter,
    jsonScript: jsonScriptFilter,
  });

  // prepare custom tags
  const asset = createAssetTag(defaults);
  const style = createStyleTag(
    {
      includePaths: [nodeModules],
      postcssPlugins: [
        staticUrlPlugin({ loader: asset }),
        postcssFlexbugsFixes,
        autoprefixer({ flexbox: 'no-2009' }),
      ],
      ...defaults,
    },
    { server }
  );
  const script = createScriptTag(pathPrefix, rollupEngine);

  nunjucksEngine.addCustomTags({
    asset,
    style,
    script,
    static(filepath) {
      const ext = extname(filepath);

      if (ext === '.scss' || ext === '.sass') {
        return style(filepath);
      }

      return asset(filepath);
    },
    staticabsolute(filepath) {
      const ext = extname(filepath);

      if (ext === '.scss' || ext === '.sass') {
        return style(filepath);
      }

      return asset(filepath, { absolute: true });
    },
  });

  // if an object of custom nunjucks filters was provided, add them now
  if (nunjucks.filters) {
    nunjucksEngine.addCustomFilters(nunjucks.filters);
  }

  // if an object of custom nunjucks tags was provided, add them now
  if (nunjucks.tags) {
    nunjucksEngine.addCustomTags(nunjucks.tags);
  }

  // if an object of custom nunjucks block tags was provided, add them now
  if (nunjucks.blockTags) {
    nunjucksEngine.addCustomBlockTags(nunjucks.blockTags);
  }

  // remove the output directory to make sure it's clean
  await premove(output);
}

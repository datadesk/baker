// native
import { extname, resolve } from 'path';

// packages
import autoprefixer from 'autoprefixer';
import { config } from 'dotenv';
import dotenvExpand from 'dotenv-expand';
import * as journalize from 'journalize';
import postcssFlexbugsFixes from 'postcss-flexbugs-fixes';
import { premove } from 'premove';

// local
import { NunjucksEngine } from './engines/nunjucks.js';
import { RollupEngine } from './engines/rollup.js';
import { getData } from './utils.js';

// filters
import { dateFilter } from './filters/date.js';
import { jsonScriptFilter } from './filters/json-script.js';
import { logFilter } from './filters/log.js';

// tags
import { createAssetTag } from './tags/asset.js';
import { createScriptTag } from './tags/script.js';
import { createStyleTag } from './tags/style.js';

// postcss plugins
import { staticUrlPlugin } from './postcss-plugins/static-url.js';

/**
 * @param {import("./types").BakerOptions} config
 */
export async function build({
  createPages,
  data,
  domain,
  entrypoints,
  input,
  layouts,
  nunjucks,
  output,
  pathPrefix,
  staticRoot,
}) {
  // the input directory of this baker
  input = resolve(input);

  // load the dotfile if it exists
  dotenvExpand(config({ path: resolve(input, '.env') }));

  // the likely location of the local node_modules directory
  const nodeModules = resolve(process.cwd(), 'node_modules');

  // where we will be outputting processed files
  output = resolve(input, output);

  // a special directory of files that should be considered extendable
  // templates by Nunjucks
  layouts = resolve(input, layouts);

  // a special directory where data files for passing to templates are loaded
  data = resolve(input, data);

  // a path prefix that should be applied where needed to static asset paths
  // to prep for deploy, ensures there's a leading slash
  pathPrefix = resolve('/', pathPrefix);

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
    createPages,
    ...defaults,
  });

  // add all the features of journalize to nunjucks as filters
  nunjucksEngine.addCustomFilters(journalize);

  // additional custom filters
  nunjucksEngine.addCustomFilters({
    date: dateFilter,
    log: logFilter,
    jsonScript: jsonScriptFilter,
  });

  // prepare custom tags
  const asset = createAssetTag(defaults);
  const style = createStyleTag({
    postcssPlugins: [
      staticUrlPlugin({ loader: asset }),
      postcssFlexbugsFixes,
      autoprefixer({ flexbox: 'no-2009' }),
    ],
    ...defaults,
  });
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

  // prep the data
  const context = await getData(data);

  // pass the data context to rollup and nunjucks
  rollupEngine.context = context;
  nunjucksEngine.context = context;

  // compile the scripts
  await rollupEngine.build();

  // build the HTML
  await nunjucksEngine.build();
}

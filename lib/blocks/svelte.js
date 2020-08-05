// native
const { join } = require('path');

// packages
const requireFromString = require('require-from-string');
const { rollup } = require('rollup');
const { babel } = require('@rollup/plugin-babel');
const commonjs = require('@rollup/plugin-commonjs');
const json = require('@rollup/plugin-json');
const { nodeResolve } = require('@rollup/plugin-node-resolve');
const sveltePlugin = require('rollup-plugin-svelte');

function createSvelteBlock(inputDir) {
  // all valid input extensions
  const extensions = ['.js', '.jsx', '.mjs', '.ts', '.tsx'];

  const inputOptions = {
    plugins: [
      nodeResolve({ extensions }),
      json(),
      sveltePlugin({ generate: 'ssr', hydratable: true }),
      babel({
        babelHelpers: 'bundled',
        exclude: 'node_modules/**',
        extensions,
        presets: [
          [
            require.resolve('@babel/preset-typescript'),
            {
              allowDeclareFields: true,
              onlyRemoveTypeImports: true,
            },
          ],
        ],
      }),
      commonjs(),
    ],
    inlineDynamicImports: true,
  };

  const outputOptions = { exports: 'default', format: 'cjs' };

  async function svelte(componentPath, props, cb) {
    // make sure we have key-value props
    if (!props.__keywords) {
      cb(new Error('The {% svelte %} block requires keyword arguments'));
    }

    // get rid of the flag
    delete props.__keywords;

    const input = join(inputDir, componentPath);

    // prepare the bundle
    const bundle = await rollup({
      input,
      ...inputOptions,
    });

    // generate our output
    const { output } = await bundle.generate(outputOptions);

    // we only care about our singular bundle and its code
    const code = output[0].code;

    // prep our rendered Component
    const Component = requireFromString(code);

    cb(undefined, Component.render(props).html);
  }

  svelte.async = true;

  return svelte;
}

module.exports = { createSvelteBlock };

const path = require('path');

/**
 * Prepares an import statement for a script to be added to the mock file.
 *
 * @private
 * @param path Path to the script to import
 */
const exporter = path => `import ${JSON.stringify(path)};`;

const VIRTUAL_KEY = '\u0000concat-entry:';
const RENDERED_VIRTUAL_KEY = '_concat-entry:';

function concatEntry() {
  // a mapping of a key representing the virtual entry and its sources
  const map = new Map();

  return {
    name: 'concat-entry',

    options(options) {
      // grab the input off the options
      const input = options.input; // if input doesn't exist, just stop here, Rollup with throw later

      // if we just don't have an input return
      if (!input) return;

      if (Array.isArray(input)) {
        // handle an input Array
        const lastEntry = input[input.length - 1];

        // pull out the file name
        const { name } = path.parse(lastEntry);

        // map the final input name to the input
        map.set(name, input);

        // alter the entry input
        options.input = name;
      } else if (typeof input === 'object') {
        // handle an input Object
        const newInputs = [];

        for (const [key, value] of Object.entries(options.input)) {
          // always make sources an array
          const sources = Array.isArray(value) ? value : [value];

          // create the virtual key to track across Rollup
          const newKey = `${VIRTUAL_KEY}${key}`;

          // map the sources to the key
          map.set(newKey, sources);

          // add the input key to the list
          newInputs.push(newKey);
        }

        options.input = newInputs;
      }
    },

    resolveId(source) {
      if (map.has(source)) {
        return source;
      }
    },

    load(id) {
      const sources = map.get(id);

      if (sources) {
        return sources
          .map(source => path.resolve(source))
          .map(exporter)
          .join('\n');
      }
    },

    generateBundle(_, bundle) {
      Object.keys(bundle).forEach(name => {
        if (name.includes(RENDERED_VIRTUAL_KEY)) {
          bundle[name.replace(RENDERED_VIRTUAL_KEY, '')] = bundle[name];
          delete bundle[name];
        }
      });

      Object.values(bundle).forEach(chunk => {
        chunk.fileName = chunk.fileName.replace(RENDERED_VIRTUAL_KEY, '');

        if (chunk.facadeModuleId) {
          chunk.facadeModuleId = chunk.facadeModuleId.replace(VIRTUAL_KEY, '');
        }

        if (chunk.map) {
          chunk.map.file = chunk.map.file.replace(RENDERED_VIRTUAL_KEY, '');
        }
      });
    },
  };
}

module.exports = { concatEntry };

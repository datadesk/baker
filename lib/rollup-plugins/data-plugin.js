// local
import { isObject } from '../utils.js';

// vendor
import { dlv } from '../vendor/dlv.js';

const moduleStart = 'data:';

export function dataPlugin(data) {
  return {
    name: 'data-plugin',

    resolveId(id) {
      if (!id.startsWith(moduleStart)) return;
      return id;
    },

    load(id) {
      if (!id.startsWith(moduleStart)) return;

      const key = id.slice(moduleStart.length);
      const value = dlv(data, key);

      if (value === undefined) {
        this.error(`"${key}" returned an undefined value.`);
        return;
      }

      if (isObject(value)) {
        this.error(
          `To prevent leakage or importing too much data, you can only use "${moduleStart}:*" to output simple values. "${key}" tried to return a value with a type of "${typeof value}".`
        );
        return;
      }

      return `export default ${JSON.stringify(value)};`;
    },
  };
}

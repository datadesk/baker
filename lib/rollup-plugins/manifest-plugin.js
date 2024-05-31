import fs from 'fs';

/**
 * @typedef {import('rollup').Plugin} RollupPlugin
 *
 *
 * @returns {{generateBundle(*, *): void, name: string}}
 */
export function manifestPlugin() {
  return {
    name: 'manifest-plugin',
    generateBundle({ dir }, bundle) {
      const manifest = {};
      for (const value of Object.values(bundle)) {
        const filePathArray = value.facadeModuleId.split('/');
        const key = filePathArray[filePathArray.length - 1] || value.fileName;
        manifest[key] = value.fileName;
      }

      fs.writeFileSync(
        `${dir}/manifest.json`,
        JSON.stringify(manifest, null, 2)
      );
    },
  };
}

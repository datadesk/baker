export function dynamicImportPlugin() {
  return {
    name: 'dynamic-import-polyfill',
    renderDynamicImport() {
      return {
        left: '__import__(',
        right: ')',
      };
    },
  };
}

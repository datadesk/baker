export default {
  input: './example',
  entrypoints: 'scripts/{app,client}.{js,ts}',
  pathPrefix: '/',
  domain: 'https://www.latimes.com',
  nunjucksVariables: {
    FOO: 'bar',
  },
  staticRoot: 'static',
  svelteCompilerOptions: {
    hydratable: true,
  },
};

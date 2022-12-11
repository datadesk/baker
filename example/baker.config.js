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
  createPages(createPage, data) {
    for (const obj of data.meta.list) {
        createPage(
          'object.njk',
          `/object/${obj.toLowerCase()}.json`,
          {
            obj
          }
        );
    }
  }
};

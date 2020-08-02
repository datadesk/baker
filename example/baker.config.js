module.exports = {
  input: __dirname,
  entrypoints: 'scripts/{app,client}.{js,ts}',
  pathPrefix: '/projects/hello',
  domain: 'https://www.latimes.com',
  staticRoot: 'static',
};

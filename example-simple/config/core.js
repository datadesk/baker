const { Baker } = require('../../');

function createPages(createPage, data) {
  for (const title of data.titles) {
    createPage('template.html', `${title}.html`, {
      context: { title },
    });
  }
}

const baker = new Baker({
  input: 'example-simple',
  output: '_dist',
  layouts: '_layouts',
  data: '_data',
  assets: '_assets',
  pathPrefix: '/',
  entrypoints: 'scripts/app.js',
  staticRoot: '',
  createPages,
});

module.exports = { baker };

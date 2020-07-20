// ./bin/bake.js build --input example-simple

const { Baker } = require('../');

function generatePages(renderTemplate, data) {
  for (const title of data.titles) {
    renderTemplate('template.html', `${title}.html`, {
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
  generatePages,
});

async function main() {
  await baker.serve();
}

main().catch(console.error);

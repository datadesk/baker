#!/usr/bin/env node

// packages
const colors = require('ansi-colors');
const mri = require('mri');

// local
const { Bakery } = require('../lib');
const { logErrorMessage } = require('../lib/utils');

const mriConfig = {
  default: {
    entrypoints: 'scripts/app.js',
    input: process.cwd(),
    output: '_dist',
    layouts: '_layouts',
    data: '_data',
    pathPrefix: '/',
  },
};

async function main(argv_) {
  const { _, ...flags } = mri(argv_.slice(2), mriConfig);

  // we only care about the first command, anything else is whatever
  const command = _[0];

  const bakery = new Bakery(flags);

  switch (command) {
    case 'bake':
    case 'build':
      try {
        await bakery.bake();

        console.log(colors.bold.green('The build was a success!'));
      } catch (err) {
        console.log(
          colors.bold.red("Build failed. Here's what possibly went wrong:\n")
        );
        logErrorMessage(err);
      }
      break;
    case 'serve':
      bakery.serve();
  }
}

main(process.argv).catch(console.error);

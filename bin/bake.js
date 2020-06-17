#!/usr/bin/env node

// packages
const { bold, green, red } = require('colorette');
const mri = require('mri');

// local
const { Baker } = require('../lib');
const { logErrorMessage } = require('../lib/utils');

const mriConfig = {
  default: {
    assets: 'assets',
    data: '_data',
    entrypoints: 'scripts/app.js',
    input: process.cwd(),
    layouts: '_layouts',
    output: '_dist',
    pathPrefix: '/',
    staticRoot: '',
  },
};

async function main(argv_) {
  const { _, ...flags } = mri(argv_.slice(2), mriConfig);

  // we only care about the first command, anything else is whatever
  const command = _[0];

  const baker = new Baker(flags);

  switch (command) {
    case 'bake':
    case 'build':
      try {
        await baker.bake();

        console.log(green(bold('The build was a success!')));
      } catch (err) {
        console.log(
          red(bold("Build failed. Here's what possibly went wrong:\n"))
        );
        logErrorMessage(err);
      }
      break;
    case 'serve':
      await baker.serve();
  }
}

main(process.argv).catch((err) => {
  console.error(err);
  // we want to throw a real exit value on crash and burn
  process.exit(1);
});

#!/usr/bin/env node

// packages
const mri = require('mri');

// local
const { Bakery } = require('../lib');

const mriConfig = {
  default: {
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
      bakery.bake();
      break;
    case 'serve':
      bakery.serve();
  }
}

main(process.argv).catch(console.error);

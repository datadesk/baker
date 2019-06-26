// packages
const colors = require('ansi-colors');
const hasha = require('hasha');

function getRevHash(input) {
  return hasha(input, { algorithm: 'md5' }).slice(0, 10);
}

const isInteractive = process.stdout.isTTY;

function clearConsole() {
  if (isInteractive) {
    process.stdout.write(
      process.platform === 'win32' ? '\x1B[2J\x1B[0f' : '\x1B[2J\x1B[3J\x1B[H'
    );
  }
}

function printInstructions({ external, local }) {
  console.log();
  console.log('You can now view your project in your browser!');
  console.log();

  if (local) {
    console.log(`${colors.bold('Local server URL:')}       ${local}`);
  }

  if (external) {
    console.log(`${colors.bold('URL on your network:')}    ${external}`);
  }

  console.log();
}

module.exports = { clearConsole, getRevHash, printInstructions };

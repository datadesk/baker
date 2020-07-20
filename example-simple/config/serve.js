const { baker } = require('./core');

async function main() {
  await baker.serve();
}

main().catch(console.error);

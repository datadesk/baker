const { baker } = require('./core');

async function main() {
  await baker.bake();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);

    process.exit(1);
  });

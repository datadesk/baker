import { intcomma } from 'journalize';

console.log(process.env.BAKER_DEMO_VAR);

function main() {
  console.log(intcomma(5432));
}

main();

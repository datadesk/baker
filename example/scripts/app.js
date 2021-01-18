import App from './app.svelte';
import list from 'data:meta.breed';

if (process.env.BAKER_AWS_BUCKET === 'bigbuilder') {
  console.log('a big build!');
} else {
  console.log(list);
}

async function main() {
  const { intcomma } = await import('journalize');
  console.log(intcomma(5432));

  new App({
    target: document.querySelector('#svelte'),
    props: { name: 'Svelte' },
  });

  const data = await import('dataset:./cdcr.csv');
  console.log(data);
}

main();

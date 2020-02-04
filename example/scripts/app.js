import SvelteApp from './app.svelte';

if (process.env.BAKER_AWS_BUCKET === 'bigbuilder') {
  console.log('a big build!');
} else {
  console.log('not a big build.');
}

async function main() {
  const { intcomma } = await import('journalize');
  console.log(intcomma(5432));

  new SvelteApp({
    target: document.querySelector('#svelte'),
    props: { name: 'Svelte' },
  });
}

main();

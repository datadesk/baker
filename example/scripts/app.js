import SvelteApp from './app.svelte';

console.log(process.env.BAKER_DEMO_VAR);

async function main() {
  const { intcomma } = await import('journalize');
  console.log(intcomma(5432));

  new SvelteApp({
    target: document.querySelector('#svelte'),
    props: { name: 'Svelte' },
  });
}

main();

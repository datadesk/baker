import { intcomma } from 'journalize';
import SvelteApp from './app.svelte';
import { h, render } from 'preact';

console.log(process.env.BAKER_DEMO_VAR);

function PreactApp({ name }) {
  return <h1>Hello {name}!</h1>;
}

function main() {
  console.log(intcomma(5432));

  new SvelteApp({
    target: document.querySelector('#svelte'),
    props: { name: 'Svelte' },
  });

  render(<PreactApp name="Preact" />, document.querySelector('#preact'));
}

main();

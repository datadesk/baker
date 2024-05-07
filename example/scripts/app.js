import App from './app.svelte';
import list from 'data:meta.breed';
import { csvParse } from 'd3-dsv';

if (process.env.BAKER_AWS_BUCKET === 'bigbuilder') {
  console.log('a big build!');
} else {
  console.log(list);
}

class CustomElement extends HTMLElement {
  constructor() {
    super();
    this.innerHTML = '<marquee>HELLO</marquee>';
  }
}
customElements.define('custom-element', CustomElement);

async function main() {
  const { intcomma } = await import('journalize');
  console.log(intcomma(5432));

  new App({
    target: document.querySelector('#svelte'),
    props: { name: 'Svelte' },
  });

  const { getData } = await import('./nested/internal.js');
  console.log(await getData());

  const dataUrl = new URL('./cdcr.csv', import.meta.url);
  console.log(dataUrl);
  const payload = await fetch(dataUrl).then((res) => res.text());
  console.log(payload);
  const csvData = csvParse(payload);
  console.log(csvData);
}

main();

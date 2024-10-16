import { Baker } from "../index.js";

function maxstache(str, ctx) {
  return str
    .split(/\{|\}/)
    .map((t, i) => (!(i % 2) ? t : ctx[t]))
    .join('');
}

/**
 * @param {number[]} sizes
 * @param {Baker} instance
 **/
export function createSrcSetFilter(sizes, instance) {
  return function createSrcSet(source, prefix) {
    return sizes
      .map((size) => {
        const url = instance.getStaticPath(`${maxstache(source, { size })}`);
        return `${url} ${size}w`;
      })
      .join(', ');
  };
}

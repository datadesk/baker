// Only polyfill fetch() if we're in a browser
if (typeof window !== 'undefined') {
  require('whatwg-fetch');
}

// We want to trust classList will work
require('classlist-polyfill');

// We depend on intersection-observer enough that it should just be assumed as necessary
require('intersection-observer');

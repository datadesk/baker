// Only polyfill fetch() if we're in a browser
import 'whatwg-fetch';

// We want to trust classList will work
import 'classlist-polyfill';

// We depend on intersection-observer enough that it should just be assumed as necessary
import 'intersection-observer';

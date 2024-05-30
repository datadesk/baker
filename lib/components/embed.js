const BakerComponent = require('./web-component.js');

/**
 * Returns the value of the query parameter from the script tag
 *
 * @param {string} param
 * @returns {string}
 */
function getScriptQueryParams(param) {
  const currentScript = document.currentScript;
  const src = currentScript.src;
  const params = new URLSearchParams(src.split('?')[1]);

  return params.get(param);
}

/**
 * Appends the webcomponents-loader script to the head if it hasn't been added yet
 *
 * returns {void}
 */
function addWebComponentsLoader() {
  if (window.baker.webComponentsLoaderAdded) return;

  const scriptSrc =
    'https://unpkg.com/@webcomponents/webcomponentsjs@2.8.0/webcomponents-loader.js';
  const script = document.createElement('script');

  script.src = scriptSrc;
  script.defer = true;
  document.head.appendChild(script);

  window.baker.webComponentsLoaderAdded = true;
}

/**
 * Appends the baker custom element script to the body
 * @param {string} filepath
 */
function addBakerElementScript(filepath) {
  if (window.baker.customElementScriptAdded) return;

  const script = document.createElement('script');
  script.src = filepath;
  script.charset = 'utf-8';

  document.body.appendChild(script);
  window.baker.customElementScriptAdded = true;
}

/**
 * Prepends a baker element before the current script element.
 *
 * @param {string} queryParam
 * returns {void}
 */
function prependBakerElement(queryParam) {
  /**
   * Type cast the current script element to Node
   *
   * @type {Node}
   */
  const currentScript /** @type {Node} */ = document.currentScript;

  if (!currentScript) {
    console.error('Failed to find the current script element');
    return;
  }

  const bakerElement = document.createElement(BakerComponent.customElementName);
  bakerElement.id = getScriptQueryParams(queryParam);

  currentScript.parentNode.insertBefore(bakerElement, currentScript);
}

/**
 * Initializes the custom elements
 *
 * @returns {Promise<void>}
 */
async function init() {
  addWebComponentsLoader();
}

window.baker = window.baker || {};

/**
 * Renders the baker component
 * @param {string} webComponentPath
 * @param {string} param
 * @returns {void}
 */
window.baker.render = async function ({ param, webComponentPath }) {
  try {
    await init();
    addBakerElementScript(webComponentPath);
    await BakerComponent.register();
    prependBakerElement(param);
  } catch (e) {
    console.error('Failed to render the baker component', e);
  }
};

window.baker.render({
  param: 'id',
  webComponentPath: 'example/_dist/embeds/web-component.js',
});

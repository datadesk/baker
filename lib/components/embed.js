const BakerWebComponent = require('./web-component.js');

/**
 * Returns the value of the query parameter from the script tag
 *
 * @param {string} param
 * @param {HTMLScriptElement} currentScript
 * @returns {string}
 */
function getScriptQueryParams(param, currentScript) {
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
 * @param {Node} currentScript
 * returns {void}
 */
function prependBakerElement(queryParam, currentScript) {
  const bakerElement = document.createElement(
    BakerWebComponent.customElementName
  );
  bakerElement.id = getScriptQueryParams(queryParam, currentScript);

  currentScript.parentNode.insertBefore(bakerElement, currentScript);
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
    // Add the webcomponents-loader script
    addWebComponentsLoader();
    // Capture the current script element
    const currentScript = document.currentScript;
    if (!currentScript) {
      console.error('Failed to find the current script element');
      return;
    }
    // Extract the base URL from the current script's src attribute
    const baseURL = currentScript.src.split('/').slice(0, -1).join('/') + '/';
    // Load the manifest file
    const response = await fetch(`${baseURL}manifest.json`);
    if (!response.ok) {
      console.error('Failed to fetch manifest');
      return;
    }
    const manifest = await response.json();
    // Replace webComponentPath with the hashed filename from the manifest
    const hashedPath = manifest[webComponentPath] || webComponentPath;

    // Add the baker custom element script
    addBakerElementScript(`${baseURL}${hashedPath}`);
    // Register the baker custom element
    await BakerWebComponent.register();
    // Prepend the baker element next to the current script element
    prependBakerElement(param, currentScript);
  } catch (e) {
    console.error('Failed to render the baker component', e);
  }
};

window.baker.render({
  param: 'id',
  webComponentPath: 'web-component.js',
});

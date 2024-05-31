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
 *
 * @param {string} filepath
 */
function addBakerElementScript(filepath) {
  if (window.baker.customElementScriptAdded) return;

  const script = document.createElement('script');
  script.src = filepath;

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
    'baker-element'
  );
  // Set the data-id attribute
  bakerElement.setAttribute('data-id', getScriptQueryParams(queryParam, currentScript));

  currentScript.parentNode.insertBefore(bakerElement, currentScript);
}

window.baker = window.baker || {};

/**
 * Renders the baker component
 *
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

    // Add the baker custom element script
    addBakerElementScript(`__BAKER_PATH_PREFIX__/embeds/${webComponentPath}`);

    // Prepend the baker element next to the current script element
    prependBakerElement(param, currentScript)
  } catch (e) {
    console.error('Failed to render the baker component', e);
  }
};

window.baker.render({
  param: 'id',
  webComponentPath: '__WEB_COMPONENTS_HASH__',
});

class BakerWebComponent extends HTMLElement {
  constructor() {
    super();
  }

  static get customElementName() {
    return 'baker-element';
  }

  async connectedCallback() {
    const bakerId = this.getAttribute('data-id');

    if (!bakerId) {
      console.error(
        'Failed to find the file path for the element id: ',
        bakerId
      );
      return;
    }

    const response = await fetch(
      `${BakerWebComponent.getBaseURL()}/${bakerId}/index.html`
    );
    if (!response.ok) {
      console.error('Failed to fetch the embed content');
      return;
    }

    const shadow = this.attachShadow({ mode: 'open' });
    const fragment = document.createDocumentFragment();

    const htmlContent = await response.text();
    const doc = await BakerWebComponent.parseHTML(htmlContent);

    if (!doc) {
      console.error('Failed parse the embed content');
      return;
    }

    fragment.appendChild(doc.body.cloneNode(true));

    const styles = doc.head.querySelectorAll('style, link[rel="stylesheet"]');
    styles.forEach((style) => {
      fragment.appendChild(style.cloneNode(true));
    });

    shadow.appendChild(fragment);

    const scripts = doc.body.querySelectorAll('script');
    scripts.forEach((script) => {
      const newScript = document.createElement('script');
      if (script.src) {
        // External script
        newScript.src = script.src;
      } else {
        // Inline script
        newScript.textContent = script.textContent;
      }
      shadow.appendChild(newScript);
    });
  }

  /**
   * Parse the HTML content to remove meta, title, and unwanted link tags
   *
   * @param {string} htmlContent
   * @returns {Promise<Document>}
   */
  static async parseHTML(htmlContent) {
    const parser = new DOMParser();
    return parser.parseFromString(htmlContent, 'text/html');
  }

  /**
   * Register the custom element
   *
   * @returns {Promise<CustomElementConstructor>}
   */
  static register() {
    // Register our custom element
    if (!window.customElements.get(BakerWebComponent.customElementName)) {
      window.customElements.define(
        BakerWebComponent.customElementName,
        BakerWebComponent
      );
    }

    // Wait for it
    return window.customElements.whenDefined(
      BakerWebComponent.customElementName
    );
  }

  /**
   * Parse the base URL from the baker-embed.js script
   *
   * @returns {string}
   */
  static getBaseURL() {
    // Find the baker-embed.js script in the document
    const scripts = document.getElementsByTagName('script');
    let baseURL = '';
    for (const script of scripts) {
      if (script.src.includes('baker-embed.js')) {
        baseURL = script.src.split('/').slice(0, -1).join('/') + '/';
        break;
      }
    }

    return baseURL;
  }
}

const register = async () => {
  await BakerWebComponent.register();
};

document.addEventListener('DOMContentLoaded', register);

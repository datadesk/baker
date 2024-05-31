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
      `__BAKER_PATH_PREFIX__/embeds/${bakerId}/index.html`
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
      if (style.href) {
        const newHref = `__BAKER_PATH_PREFIX__${style.getAttribute('href')}`;
        const newLink = document.createElement('link');
        newLink.rel = 'stylesheet';
        newLink.href = newHref;
        fragment.appendChild(newLink);
      } else {
        fragment.appendChild(style.cloneNode(true));
      }
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
}

const register = () => {
  if (!window.customElements.get(BakerWebComponent.customElementName)) {
    window.customElements.define(
      BakerWebComponent.customElementName,
      BakerWebComponent
    );
  }
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', register);
} else {
  register();
}

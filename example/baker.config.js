export default {
  input: './example',
  entrypoints: 'scripts/{app,client}.{js,ts}',
  pathPrefix: '/a',
  domain: 'https://www.latimes.com',
  nunjucksVariables: {
    FOO: 'bar',
  },
  staticRoot: 'static',
  svelteCompilerOptions: {
    hydratable: true,
  },
  createPages(createPage, data) {
    // Create robots.txt
    createPage('robots.txt.njk', 'robots.txt');
    const urlList = ['/', '/two/', '/three/'];
    for (const obj of data.meta.list) {
      // Create detail pages
      const objUrl = `/object/${obj.toLowerCase()}/`;
      createPage('object.njk', objUrl, { obj });
      urlList.push(objUrl);
      // Create JSON output
      const jsonUrl = `/object/${obj.toLowerCase()}.json`;
      createPage('object.json.njk', jsonUrl, {
        obj: JSON.stringify({ value: obj }, null, 2),
      });
    }
    createPage('sitemap.xml.njk', `sitemap.xml`, {
      urlList,
    });
  },
};

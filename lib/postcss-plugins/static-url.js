/**
 * @returns {import('postcss').Plugin}
 */
export function staticUrlPlugin(config) {
  const cssUrlRE = /(url\(\s*['"]?)([^"')]+)(["']?\s*\))/g;

  return {
    postcssPlugin: 'baker:rewrite-urls',
    Once(root) {
      root.walkDecls((decl) => {
        const isCssUrl = cssUrlRE.test(decl.value);

        if (isCssUrl) {
          decl.value = decl.value.replace(cssUrlRE, (_, before, url, after) => {
            return `${before}${config.loader(url)}${after}`;
          });
        }
      });
    },
  };
}

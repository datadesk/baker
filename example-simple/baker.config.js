module.exports = {
  input: __dirname,
  staticRoot: '/static/',
  createPages(createPage, data) {
    for (const title of data.titles) {
      createPage('template.html', `${title}.html`, {
        context: { title },
      });
    }
  },
  nunjucksFilters: {
    square(n) {
      n = +n;

      return n * n;
    },
  },
};

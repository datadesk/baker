module.exports = {
  // special case because it is in a directory
  input: __dirname,

  // we want to use the static root feature, so we supply the path
  staticRoot: '/static/',

  // use createPages to generate pages on the fly
  createPages(createPage, data) {
    for (const title of data.titles) {
      createPage('template.html', `${title}.html`, {
        context: { title },
      });
    }
  },

  // pass an object of filters to add to Nunjucks
  nunjucksFilters: {
    square(n) {
      n = +n;

      return n * n;
    },
    logContext() {
      console.log(this.context);

      return 'check console';
    },
  },
};

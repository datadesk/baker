<img src="./.github/baker.jpg" alt="Baker" width=250>

`@datagraphics/baker` is a build tool by and for the Los Angeles Times. The Times uses it to build the static pages published at latimes.com/projects. You can use it however you'd like.

[![npm](https://badgen.net/npm/v/@datagraphics/baker)](https://www.npmjs.org/package/@datagraphics/baker) [![install size](https://badgen.net/packagephobia/install/@datagraphics/baker)](https://packagephobia.now.sh/result?p=@datagraphics/baker)

## Installation

```sh
npm install -D @datagraphics/baker
```

## What is Baker and why do you use it?

Baker is a development environment that can be converted into a static website that’s ready for the web. With a minimal amount of HTML, CSS and JavaScript, you can publish a project on latimes.com/projects. The Los Angeles Times uses Baker to write custom code for projects that aren’t possible within the rigid templates of our content management system.

## How does Baker work?

Baker brings together a bunch of different technologies.

The HTML templating is powered by [Nunjucks](https://mozilla.github.io/nunjucks/), giving us a Jinja2-like experience for organizing and creating our HTML pages. This is also very similar to the templating language used in Django.

CSS styles are written using the preprocessor [Sass](https://sass-lang.com/). Sass enhances CSS by adding features that don't exist in CSS yet like nesting, mixins, inheritance and other tricks. Baker also uses the postprocessor called Autoprefixer, which automatically adds special prefixes to our CSS for browser support. (`--webkit`, `--moz`, etc.) 

JavaScript is bundled using [Rollup](https://www.rollupjs.org/guide/en/), which makes it possible for us to write modern JavaScript that gets optimized and prepared in a way that makes it load as fast as possible for our users. Code we write is passed through a JavaScript compiler called [Babel](https://babeljs.io/), which rewrites our code to make sure it works in all the browsers we support.

Data imports, powered by [quaff](https://www.npmjs.com/package/quaff), allow for easily imported structured data files into templates, which is useful for making data visualizations.

## How do I get started using it?

A page template at [github.com/datadesk/baker-example-page-template](https://github.com/datadesk/baker-example-page-template) is our premade starter that comes with a bunch of HTML, styles and scripts ready for you to start a project with. It also includes GitHub Actions that can deploy staging and production version of your page. It works after only minimal configuration.

## Contributing

[Fork](https://docs.github.com/en/get-started/quickstart/fork-a-repo) the repository and [clone](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository) it locally. The enter the code directory and install the package's dependencies.

```sh
npm install
```

[Branch](https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging) off. Make any changes. Preview them with the test server.

```sh
npm start
```

Run our tests.

```sh
npm run build
```

Once they pass, your changes should be briefly documented in the `CHANGELOG.md` file under the `[Unreleased]` header. Depending on the type of change you are making, you may need to add a new subheader as defined by [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). For example, if you are changing how a feature works, you may need to add a `### [Changed]` subhead.

[Commit](https://git-scm.com/docs/git-commit). Submit a [pull request](https://docs.github.com/en/github/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request).

## Releasing

This package is distributed using npm. To publish a new release, you will need to have an [npmjs](https://www.npmjs.com/) account with ownership of the [@datagraphics/baker](https://www.npmjs.com/package/@datagraphics/baker) namespace.

Next you should use npm's version command to up the version number. You have to decide if you're a major, minor or patch release. If you're unsure, review the standards defined at [semver.org](https://semver.org/). Then run one of the commands below. The code will be updated appropriately.

```sh
# Pick one and only one!
npm version major
npm version minor
npm version patch
```

Rename the `[Unreleased]` section of the `CHANGELOG.md` with the same version number. Commit.

```sh
git add CHANGELOG.md
git commit -m "Updated CHANGELOG"
```

Release the new version of the package.

```sh
npm publish
```

Push your work to GitHub.

```sh
git push origin main
```

Create a new release on GitHub at [github.com/datadesk/baker/releases](https://github.com/datadesk/baker/releases) with the same version number. Paste the changelog entry into the post as a bullet list.

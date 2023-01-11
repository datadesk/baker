<img src="./.github/baker.jpg" alt="Baker" width=250>

`@datagraphics/baker` is a build tool by and for the Los Angeles Times. The Times uses it to build the static pages published at latimes.com/projects. You can use it however you'd like.

An example of how The Times puts the package to use is available at [datadesk/baker-example-page-template](https://github.com/datadesk/baker-example-page-template).

[![npm](https://badgen.net/npm/v/@datagraphics/baker)](https://www.npmjs.org/package/@datagraphics/baker)

## Requirements

* [Node.js](https://nodejs.org/en/) version 12, 14 or 16, though at minimum 12.20, 14.14, or 16.0.
* [Node Package Manager](https://www.w3schools.com/whatis/whatis_npm.asp)

## Installation

```sh
npm install -D @datagraphics/baker
```

## What is Baker and why do you use it?

Baker is a development environment that can be converted into a static website that’s ready for the web. With a minimal amount of HTML, CSS and JavaScript, you can publish a project. The Los Angeles Times uses Baker to write custom code for projects that aren’t possible within the rigid templates of our content management system.

## Does anyone else use Baker?

Yes. Here are some examples of Baker is use outside of the Los Angeles Times.

* [AMSAT’s amateur satellite index](https://amsat.org/amateur-satellite-index)
* The ["First Visual Story"](https://palewi.re/docs/first-visual-story/) training tutorial by [Ben Welsh](https://palewi.re/who-is-ben-welsh/), [Armand Emamdjomeh](http://emamd.net/) and [Vanessa Martinez](https://www.vanessa-martinez.com/)
* [e.e. cummings free poetry archive](https://cummings.ee/) by [Ben Welsh](https://palewi.re/who-is-ben-welsh/)
* [Noodle Tracker](https://noodletracker.com/) by [Matt Stiles](https://mattstiles.me/)
* [hotsauce.gay](https://hotsauce.gay/) and [men who don't move](https://caseymm.github.io/men-who-dont-move/) by [Casey Miller](https://caseymmiller.com/)
* A variety of news applications by [ProPublica](https://propublica.org), including ["Does Your Local Museum or University Still Have Native American Remains?"](https://projects.propublica.org/repatriation-nagpra-database/) and ["Look Up Which Fortune 500 Companies Fund Election Deniers"](https://projects.propublica.org/fortune-500-company-election-deniers-jan-6/).
* ["Did your neighborhood turn out to vote?"](https://projects.thecity.nyc/zeldin-hochul-election-voter-turnout-nyc/) and other features by [THE CITY](https://www.thecity.nyc/)
* [Maryland precinct-level election results](https://www.thebaltimorebanner.com/politics-power/state-government/precinct-level-governor-election-vote-data-O25RWFHG35DEFCYOZNZDVRS374/) by [The Baltimore Banner](https://www.thebaltimorebanner.com/)

If you know of other examples, please add them to the list.

## How does Baker work?

Baker brings together a bunch of different technologies.

The HTML templating is powered by [Nunjucks](https://mozilla.github.io/nunjucks/), giving us a Jinja2-like experience for organizing and creating our HTML pages. This is also very similar to the templating language used in Django.

CSS styles are written using the preprocessor [Sass](https://sass-lang.com/). Sass enhances CSS by adding features that don't exist in CSS yet like nesting, mixins, inheritance and other tricks. Baker also uses the postprocessor called Autoprefixer, which automatically adds special prefixes to our CSS for browser support. (`--webkit`, `--moz`, etc.) 

JavaScript is bundled using [Rollup](https://www.rollupjs.org/guide/en/), which makes it possible for us to write modern JavaScript that gets optimized and prepared in a way that makes it load as fast as possible for our users. Code we write is passed through a JavaScript compiler called [Babel](https://babeljs.io/), which rewrites our code to make sure it works in all the browsers we support.

Data imports, powered by [quaff](https://www.npmjs.com/package/quaff), allow for easily imported structured data files into templates, which is useful for making data visualizations.

## How do I get started using it?

The repository at [github.com/datadesk/baker-example-page-template](https://github.com/datadesk/baker-example-page-template) is our premade starter that comes with HTML, styles and scripts ready for experimentation. It also includes GitHub Actions that can deploy staging and production version of your page. It works after only minimal configuration. You could customize it to match the look and feel of your site.

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

Push your work to GitHub, including tag created by the `npm version` command.

```sh
git push origin main --tags
```

Create a new release on GitHub at [github.com/datadesk/baker/releases](https://github.com/datadesk/baker/releases) with the same version number. Paste the changelog entry into the post as a bullet list.

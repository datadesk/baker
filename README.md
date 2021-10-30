# @datagraphics/baker

[![npm](https://badgen.net/npm/v/@datagraphics/baker)](https://www.npmjs.org/package/@datagraphics/baker) [![install size](https://badgen.net/packagephobia/install/@datagraphics/baker)](https://packagephobia.now.sh/result?p=@datagraphics/baker)

<img src="./.github/baker.jpg" alt="Baker" width=250>

`@datagraphics/baker` is a build tool by and for the Los Angeles Times. The Times uses it to build static pages to publish at latimes.com/projects. You can use it however you'd like.

## Installation

```sh
npm install -D @datagraphics/baker
```

## Contributing

[Fork](https://docs.github.com/en/get-started/quickstart/fork-a-repo) the repository and [clone](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository) it locally. The enter the code directory and install the package's dependencies.

```sh
npm install
```

[Branch](https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging) off. Make any changes. Run our tests.

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

Create a new release on GitHub at [github.com/datadesk/baker/releases](https://github.com/datadesk/baker/releases) with the same version number. Paste the changelog entry into the post as a bullet list.

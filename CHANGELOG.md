# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.9.0] - 2019-11-18

### Added

- Modern JavaScript builds now use [`@babel/preset-modules`](https://github.com/babel/preset-modules). This should result in even smaller modern bundles that natively support features that already exist in ~85% of browsers.

### Removed

- Automatic web polyfill injection has been removed. It's just too much magic going on, and we shouldn't assume that every single thing will need `fetch` + `intersection-observer` + `classlist` injected into it. (JavaScript features are still polyfilled via `core-js`. In other words if it's something you'd be able to do in Node.js it's handled.) The gains of keeping a few polyfills out of the modern build aren't worth the confusion. However this does mean users are now responsible for importing their own polyfills.

## [0.8.0] - 2019-11-03

### Added

- The Rollup engine now supports both Svelte (`.svelte` files) and Preact (the usage of JSX) as options for JavaScript-based HTML templating.

### Changed

- `browser-sync` has been replaced with [`mini-sync`](https://github.com/rdmurphy/mini-sync). `browser-sync` was one of the largest packages installed in `baker`, and this should lead to quicker install times.

### Removed

- The old legacy Rollup engine has been deleted and the one previously called `rollup2.js` has taken its place.

## [0.7.0] - 2019-10-18

### Added

- Support for correctly formatted environment variables that are passed to `rollup-plugin-replace` has been added. Any environment variable that begins with `BAKER_` will be read and converted to the `process.env.BAKER_*` format that can be used in JavaScript files. Any environmental variables that do not have a match are ignored.

It's also possible to manage these with a `.env` in the root of your project. The same rule regarding the `BAKER_` prefix applies.

## [0.6.0] - 2019-09-17

### Added

- Two custom functions have been added to the `sass` renderer — `static-url` and `static-path`. These are implemented against the Node.js API (and not within a Sass file) because they need to reference the static asset manifests. They are used in the same scenarios as the `{% static %}` block in Nunjucks templates — you need to reference the path to a static asset in your project, but need it to be given the correct hash prefix on production builds.

`static-url` is meant to be a shortcut for anything you'd normally put inside of `url()`, which it will include for you.

_SCSS_

```scss
body {
  background-image: static-url('assets/background.png');
}
```

_CSS_

```css
body {
  background-image: url(/assets/background.123abc.png);
}
```

`static-path` only adjusts the path and returns it as a string. This will probably be less used, but it's there as an escape hatch if you need it.

```scss
body {
  background-image: url(static-path('assets/background.png'));
}
```

_CSS_

```css
body {
  background-image: url(/assets/background.123abc.png);
}
```

### Changed

- Now only valid images will receive the file hash in production mode. This is imperfect, but better than every random asset getting a hash unnecessarily and causing issues when they're used. (Looking at you, `.gltf` files.) Ideally this would be smarter, but not quite sure how to go about that yet.

## [0.5.0] - 2019-09-04

### Added

- Nunjucks templates now have a better error logger. It's not perfect, but should help find specific lines causing issues.
- Template files in the layout directory are now watched during a serve - if any changes are made templates are regenerated.
- Files in the `data` directory are now watched during a serve and will trigger a template build.

### Changed

- This package is now deployed on `npm` at `@datagraphics/baker` instead of `@datadesk/baker`, which has been deprecated.

## [0.4.0] - 2019-09-03

### Added

- Legacy script builds now use `core-js` to polyfill and add features that may be missing in those browsers. This will likely cause the `iife` build to be bigger than it should be, but this prevents users from having to whack-a-mole issues with IE 11. It should just work.
- Polyfills for both the modern and legacy are automatically inserted into every entrypoint, with the assumption there's a base set of features we should expect to be there. For modern builds, it's support for dynamic imports and IntersectionObserver. For legacy builds, it's fetch, Element.classList and IntersectionObserver.

### Changed

- The engine for Rollup has been rewritten to be much smarter about how it navigates modern and legacy builds. This also does away with SystemJS in favor of native modules for browsers that support it, and an `iife` build for browsers that do not.

## [0.3.0] - 2019-08-16

### Added

- Added `AssetsEngine` for management of generic assets files in a build. By default it looks for an `assets` directory in the input directory.

### Changed

- The `ImagesEngine` is no more and has been merged into `AssetsEngine`. This means that images _must_ be in the `assets` directory to be found and handled.

## [0.2.1] - 2019-08-16

### Fixed

- A `pathPrefix` should always have a leading slash to ensure pathing resolution works.

## [0.2.0] - 2019-08-08

### Changed

- The serve task now runs all the engines in an initial pass before activating the server. This ensures that the local development URL is not presented as available before it truly is.

## [0.1.0] - 2019-08-07

### Added

- Initial release.

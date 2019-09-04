# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

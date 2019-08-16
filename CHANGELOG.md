# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- A `pathPrefix` should always have a leading slash to ensure pathing resolution works.

## [0.2.0] - 2019-08-08

### Changed

- The serve task now runs all the engines in an initial pass before activating the server. This ensures that the local development URL is not presented as available before it truly is.

## [0.1.0] - 2019-08-07

### Added

- Initial release.

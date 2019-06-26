# The Second Bake

This is a workspace repository for the grand reworking of Big Builder. It is in **no way** ready for prime time and carries no promise of being remotely functional at any given time.

Having said that, feel free to to clone this repo and poke around.

## Setting up

This project assumes you already have Node.js and the Yarn package manager installed. First clone this repo, then install the dependencies using Yarn.

```sh
# install dependencies
yarn
```

## Usage

Everything in the `example/` directory is our "test" project, and the npm scripts currently point at this directory for running the commands.

To pretend you are developing this project, run the `start` command. This should spin up a server and give you a URL to visit.

```sh
yarn start
```

To pretend you are building the project, run the `build` command.

```sh
yarn build
```

Everything that is produced will go into the default output directory. For the example project, this will be the `example/_dist` directory.

## License

MIT

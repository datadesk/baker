// packages
import colors from 'ansi-colors';
import hasha from 'hasha';

/**
 * A helper noop function.
 */
function noop() {}

/**
 * Generates the 8 character md5 hash of a string.
 *
 * @param input The string to hash
 */
function getRevHash(input: string) {
  return hasha(input, { algorithm: 'md5' }).slice(0, 8);
}

/**
 * Cache a check of whether we are in an interactive terminal.
 */
const isInteractive = process.stdout.isTTY;

/**
 * Clears the terminal if it is interactive.
 */
function clearConsole() {
  if (isInteractive) {
    process.stdout.write(
      process.platform === 'win32' ? '\x1B[2J\x1B[0f' : '\x1B[2J\x1B[3J\x1B[H'
    );
  }
}

/**
 * Prints out the local and external IP's during a serve.
 */
function printInstructions({
  external,
  local,
}: {
  external: string;
  local: string;
}) {
  console.log();
  console.log('You can now view your project in your browser!');
  console.log();

  if (local) {
    console.log(`${colors.bold('Local server URL:')}       ${local}`);
  }

  if (external) {
    console.log(`${colors.bold('URL on your network:')}    ${external}`);
  }

  console.log();
}

/**
 * A standard Error interface with an extra field called "frame".
 */
interface EnhancedError extends Error {
  /** Some of our libaries add extra values to Errors called "frame". */
  frame?: string;
}

/**
 * Logs a collection of errors to the terminal.
 *
 * @param err An individual error or array of errors to log
 */
function logErrorMessage(err: EnhancedError | EnhancedError[]) {
  if (!Array.isArray(err)) err = [err];

  err.forEach(e => {
    if (e.message) {
      console.error(e.message);

      if (e.frame) {
        console.error(e.frame);
      }
    } else {
      console.error(e);
    }
  });

  console.log('\n');
}

function onError(type: string, err: EnhancedError) {
  console.log(colors.red(`${type} failed to compile.\n`));
  logErrorMessage(err);
}

function onWarning(type: string, err: EnhancedError) {
  console.log(colors.yellow(`${type} compiled with warnings.\n`));
  logErrorMessage(err);
}

export {
  clearConsole,
  getRevHash,
  logErrorMessage,
  noop,
  onError,
  onWarning,
  printInstructions,
};

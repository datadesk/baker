// packages
import { format, isDate, parseISO } from 'date-fns';

export function date(value, formatString) {
  if (!formatString) {
    throw new Error('A "formatString" must be passed to the date filter');
  }

  // we want to be able to accept both ISO date strings and Date objects,
  // so we check for that and convert if needed
  if (!isDate(value)) {
    value = parseISO(value);
  }

  // TODO: should we check with isDate again just in case parseISO
  // returned an invalid date?

  return format(value, formatString);
}

const _jsonScriptMap = {
  '>': '\\u003E',
  '<': '\\u003C',
  '&': '\\u0026',
};

const escapeHtmlRegex = new RegExp(
  `[${Object.keys(_jsonScriptMap).join('')}]`,
  'g'
);

function escapeHtml(text) {
  return text.replace(escapeHtmlRegex, (m) => _jsonScriptMap[m]);
}

export function jsonScript(value, elementId) {
  return `<script id="${elementId}" type="application/json">${escapeHtml(
    JSON.stringify(value)
  )}</script>`;
}

export function log(value) {
  // log the input
  console.log(value);

  // output the value
  return value;
}

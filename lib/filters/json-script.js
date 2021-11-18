export const _jsonScriptMap = {
  '>': '\\u003E',
  '<': '\\u003C',
  '&': '\\u0026',
};

export const escapeHtmlRegex = new RegExp(
  `[${Object.keys(_jsonScriptMap).join('')}]`,
  'g'
);

export function escapeHtml(text) {
  return text.replace(escapeHtmlRegex, (m) => _jsonScriptMap[m]);
}

export function jsonScriptFilter(value, elementId) {
  return `<script id="${elementId}" type="application/json">${escapeHtml(
    JSON.stringify(value)
  )}</script>`;
}


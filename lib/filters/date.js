const { format, isDate, parseISO } = require('date-fns');
const localeLookup = require('date-fns/locale');

function dateFilter(value, formatString, locale = 'en') {
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

  return format(value, formatString, { locale: localeLookup[locale] });
}

module.exports = { dateFilter };

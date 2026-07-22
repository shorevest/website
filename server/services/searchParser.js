'use strict';

/**
 * Natural-language search parser. Parses SUPPORTED patterns into structured
 * rules and reports whether it understood the query. It deliberately does not
 * pretend to understand arbitrary sentences — unsupported input returns
 * interpreted:false so the UI can say "adjust the rules below".
 *
 * Both the original query and the structured rules are stored on the audience.
 */

const COUNTRIES = ['Denmark', 'Sweden', 'Norway', 'Finland', 'Germany', 'United Kingdom', 'United States', 'Canada', 'Singapore', 'Japan', 'Australia'];
const REGIONS = { asia: 'Asia-Pacific', 'asia-pacific': 'Asia-Pacific', apac: 'Asia-Pacific', europe: 'Europe', nordic: 'Europe', nordics: 'Europe', americas: 'Americas', 'north america': 'Americas' };
const TYPES = { pension: 'Pension', foundation: 'Foundation', endowment: 'Endowment', insurance: 'Insurance', 'family office': 'Family Office', capital: 'Asset Manager' };
const TITLES = ['cio', 'chief investment officer', 'director', 'head of', 'portfolio manager', 'analyst'];

function parse(query) {
  const text = String(query || '').toLowerCase();
  const rules = {};
  const matched = [];

  for (const c of COUNTRIES) {
    if (text.includes(c.toLowerCase())) { rules.country = c; matched.push(c); break; }
  }
  for (const [key, val] of Object.entries(REGIONS)) {
    if (text.includes(key)) { rules.region = val; matched.push(key); break; }
  }
  for (const [key, val] of Object.entries(TYPES)) {
    if (text.includes(key)) { rules.institutionType = val; matched.push(key); break; }
  }
  if (/\bdeparted|left|former\b/.test(text)) { rules.status = 'departed'; matched.push('departed'); }
  else if (/\bactive|current\b/.test(text)) { rules.status = 'active'; matched.push('active'); }
  for (const t of TITLES) {
    if (text.includes(t)) { rules.titleIncludes = t; matched.push(t); break; }
  }

  const interpreted = Object.keys(rules).length > 0;
  return {
    interpreted,
    rules,
    matchedTerms: matched,
    message: interpreted ? null : 'We could not interpret this search reliably. Adjust the rules below.',
  };
}

module.exports = { parse, COUNTRIES, REGIONS, TYPES, TITLES };

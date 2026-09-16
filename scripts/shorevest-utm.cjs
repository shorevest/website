'use strict';

const SHOREVEST_ORIGIN = 'https://shorevest.com';

function slug(value) {
  return String(value == null ? '' : value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

function requiredSlug(value, field) {
  const out = slug(value);
  if (!out) throw new Error(`${field} is required.`);
  return out;
}

function buildUtmUrl(options = {}) {
  const base = options.base || `${SHOREVEST_ORIGIN}/`;
  const url = new URL(base, `${SHOREVEST_ORIGIN}/`);
  const host = url.hostname.toLowerCase();

  if (host !== 'shorevest.com' && host !== 'www.shorevest.com') {
    throw new Error('UTM builder only accepts ShoreVest-owned shorevest.com URLs.');
  }

  url.protocol = 'https:';
  url.hostname = 'shorevest.com';
  url.port = '';

  url.searchParams.set('utm_source', requiredSlug(options.source || 'email', 'utm_source'));
  url.searchParams.set('utm_medium', requiredSlug(options.medium || 'ir_outreach', 'utm_medium'));
  url.searchParams.set('utm_campaign', requiredSlug(options.campaign, 'utm_campaign'));

  if (options.content) url.searchParams.set('utm_content', requiredSlug(options.content, 'utm_content'));
  else url.searchParams.delete('utm_content');

  if (options.term) url.searchParams.set('utm_term', requiredSlug(options.term, 'utm_term'));
  else url.searchParams.delete('utm_term');

  return url.toString();
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    const key = arg.slice(2);
    if (!['base', 'source', 'medium', 'campaign', 'content', 'term'].includes(key)) {
      throw new Error(`Unknown option: --${key}`);
    }
    const value = argv[i + 1];
    if (value == null || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    options[key] = value;
    i += 1;
  }
  return options;
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    process.stdout.write(`${buildUtmUrl(options)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { SHOREVEST_ORIGIN, slug, buildUtmUrl, parseArgs };

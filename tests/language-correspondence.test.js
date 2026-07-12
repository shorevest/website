const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function languageHrefs(file) {
  const html = read(file);
  const hrefs = [];
  const re = /<a\s+[^>]*class="[^"]*(?:sv-lang|sv-util-btn)[^"]*"[^>]*href="([^"]+)"[^>]*>[^<]*(?:中文|<span[^>]*>中文<\/span>|.*中文)[\s\S]*?<\/a>/g;
  let match;
  while ((match = re.exec(html)) !== null) {
    hrefs.push(match[1]);
  }
  return hrefs;
}

const explicitMappings = new Map([
  ['investor-portal/index.html', '../investor-access_cn.html'],
]);

const englishPages = fs.readdirSync(root)
  .filter((file) => file.endsWith('.html'))
  .filter((file) => !file.endsWith('_cn.html'))
  .filter((file) => file !== 'investor-portal.html');

englishPages.forEach((file) => {
  const expected = file.startsWith('china-debt-dynamics')
    ? 'insights_cn.html#archive'
    : fs.existsSync(path.join(root, file.replace(/\.html$/, '_cn.html')))
      ? file.replace(/\.html$/, '_cn.html')
      : null;

  if (!expected) return;

  languageHrefs(file).forEach((href) => {
    assert.strictEqual(href, expected, `${file} Chinese language link should point to ${expected}`);
  });
});

explicitMappings.forEach((expected, file) => {
  languageHrefs(file).forEach((href) => {
    assert.strictEqual(href, expected, `${file} Chinese language link should point to ${expected}`);
  });
});

console.log('language correspondence tests passed');

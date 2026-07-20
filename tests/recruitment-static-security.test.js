const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const files = ['careers.html','careers_cn.html','careers/index.html','assets/js/recruitment-role-list.js','assets/js/recruitment-role-detail.js','assets/data/recruitment/roles.v1.json', ...fs.readdirSync(path.join(root,'careers')).filter(f=>/^(distressed-debt-investment-manager|legal-assistant).*\.html$/.test(f)).map(f=>'careers/'+f)];
function read(f){return fs.readFileSync(path.join(root,f),'utf8');}
for (const f of files) {
  const s = read(f);
  assert.doesNotMatch(s, /mailto:/i, `${f} must not contain mailto`);
  assert.doesNotMatch(s, /<form\b/i, `${f} must not contain a fake application form`);
  assert.doesNotMatch(s, /Apply for this role|申请该职位|apply\.html|apply_cn\.html/i, `${f} must not contain application actions`);
}
assert.doesNotMatch(read('assets/data/recruitment/roles.v1.json'), /JobPosting/i, 'draft manifest does not contain JobPosting metadata');
assert.match(read('assets/js/site-config.js'), /careersOpenRolesEnabled: false/, 'careers feature flag defaults false');
console.log('recruitment static security checks passed');

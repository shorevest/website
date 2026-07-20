const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const rolePages = fs.readdirSync(path.join(root,'careers')).filter(f=>/^(distressed-debt-investment-manager|legal-assistant).*\.html$/.test(f)).map(f=>'careers/'+f);
const files = ['careers.html','careers_cn.html','careers/index.html','assets/js/recruitment-role-list.js','assets/js/recruitment-role-detail.js','assets/data/recruitment/roles.v1.json', ...rolePages];
function read(f){return fs.readFileSync(path.join(root,f),'utf8');}
for (const f of files) {
  const s = read(f);
  assert.doesNotMatch(s, /mailto:/i, `${f} must not contain mailto`);
  assert.doesNotMatch(s, /<form\b/i, `${f} must not contain a fake application form`);
  assert.doesNotMatch(s, /Apply for this role|申请该职位|apply\.html|apply_cn\.html/i, `${f} must not contain application actions`);
}
for (const f of rolePages) {
  const s = read(f);
  assert.match(s, /noindex, nofollow, noarchive/, `${f} stays noindex`);
  assert.doesNotMatch(s, /<script[^>]+application\/ld\+json[^>]*>[\s\S]*JobPosting/i, `${f} must not include JobPosting structured data`);
  assert.match(s, /preview=1/, `${f} documents preview gate`);
  assert.doesNotMatch(s, /Investment Manager|Legal Assistant|债权投资经理|法务专员/, `${f} no-JS fallback must not expose draft role content`);
}
assert.doesNotMatch(read('assets/data/recruitment/roles.v1.json'), /JobPosting/i, 'draft manifest does not contain JobPosting metadata');
assert.match(read('assets/js/site-config.js'), /careersOpenRolesEnabled: false/, 'careers feature flag defaults false');
for (const f of ['api/recruitment/applicationValidation.js','api/recruitment/fileSignatures.js','api/recruitment/handler.js','api/recruitment/core/flows.js']) {
  assert.doesNotMatch(read(f), /applicationStatement|status: active|applicationEnabled|role\.files/, `${f} does not preserve the obsolete upload-through-API contract`);
}
console.log('recruitment static security checks passed');

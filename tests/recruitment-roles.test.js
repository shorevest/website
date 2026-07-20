const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { validateManifest } = require('../scripts/validate-recruitment-roles');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root,'assets/data/recruitment/roles.v1.json'),'utf8'));
const schema = JSON.parse(fs.readFileSync(path.join(root,'assets/data/recruitment/roles.v1.schema.json'),'utf8'));
assert.deepStrictEqual(validateManifest(manifest, schema), [], 'checked-in recruitment manifest should validate');
assert.strictEqual(manifest.roles.length, 2);
assert.ok(manifest.roles.every(r => r.status === 'draft'), 'Phase 1 roles stay draft');
for (const r of manifest.roles) {
  for (const f of ['id','slug','status','title','location','department','reportingLine','employmentType','targetStartDate','roleOverview','responsibilities','requiredQualifications','preferredQualifications','recruitmentStatus','datePosted','dateUpdated','displayOrder']) assert.ok(Object.prototype.hasOwnProperty.call(r,f), `${r.id} has ${f}`);
  assert.ok(r.title.en && r.title['zh-CN']);
  assert.ok(r.responsibilities.en.length && r.responsibilities['zh-CN'].length);
}
assert.ok(manifest.roles.find(r => r.id === 'distressed-debt-investment-manager').contentReviewRequired);
console.log('recruitment role manifest contract tests passed');

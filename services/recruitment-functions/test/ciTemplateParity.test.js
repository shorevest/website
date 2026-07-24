'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert');

const root = path.resolve(__dirname, '../../..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const workflow = fs.readFileSync(
  path.join(root, '.github/workflows/recruitment-functions.yml'),
  'utf8'
);

const authoritativeTemplates = [
  'infra/recruitment/main.bicep',
  'infra/recruitment/event-grid-subscription.bicep',
  'infra/recruitment/hr-auth.bicep',
  'infra/recruitment/runtime-settings.v2.bicep',
  'infra/recruitment/lifecycle.bicep',
  'infra/recruitment/monitoring-rules.v4.bicep'
];

test('root Bicep build and lint scripts cover every authoritative recruitment template', () => {
  const build = packageJson.scripts['bicep:build:recruitment'];
  const lint = packageJson.scripts['bicep:lint:recruitment'];
  assert.equal(typeof build, 'string');
  assert.equal(typeof lint, 'string');

  for (const template of authoritativeTemplates) {
    assert.ok(build.includes(`--file ${template}`), `build script omits ${template}`);
    assert.ok(lint.includes(`--file ${template}`), `lint script omits ${template}`);
  }
});

test('root scripts do not compile the superseded runtime settings draft', () => {
  const build = packageJson.scripts['bicep:build:recruitment'];
  const lint = packageJson.scripts['bicep:lint:recruitment'];
  assert.ok(!build.includes('--file infra/recruitment/runtime-settings.bicep'));
  assert.ok(!lint.includes('--file infra/recruitment/runtime-settings.bicep'));
});

test('GitHub Actions delegates Bicep validation to authoritative root scripts', () => {
  assert.ok(workflow.includes('run: npm run bicep:build:recruitment'));
  assert.ok(workflow.includes('run: npm run bicep:lint:recruitment'));
  assert.ok(!workflow.includes('az bicep build --file infra/recruitment/main.bicep'));
});

test('recruitment CI still runs application, security, function and whitespace validation', () => {
  for (const command of [
    'npm run validate:recruitment',
    'npm run check:recruitment',
    'npm run test:recruitment',
    'npm run check:security',
    'npm run check:functions',
    'npm run test:functions',
    'git diff --check'
  ]) {
    assert.ok(workflow.includes(`run: ${command}`), `workflow omits ${command}`);
  }
});

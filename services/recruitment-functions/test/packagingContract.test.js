'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert');

const root = path.resolve(__dirname, '../../..');
const packagingScriptPath = path.join(
  root,
  'services/recruitment-functions/scripts/package.ps1'
);
const source = fs.readFileSync(packagingScriptPath, 'utf8');

test('immutable recruitment packaging script exists and uses the lockfile', () => {
  assert.equal(fs.existsSync(packagingScriptPath), true);
  assert.ok(source.includes("Join-Path $serviceRoot 'package-lock.json'"));
  assert.ok(source.includes('npm ci --omit=dev --no-audit --no-fund'));
});

test('package stages only the required Function and recruitment runtime trees', () => {
  for (const required of [
    "@('host.json', 'package.json')",
    "Join-Path $serviceRoot 'src'",
    "Join-Path $serviceRoot 'node_modules'",
    "Join-Path $repoRoot 'api/recruitment/core'",
    "Join-Path $repoRoot 'assets/data/recruitment'"
  ]) {
    assert.ok(source.includes(required), `packaging script omits ${required}`);
  }
  assert.ok(source.includes("Copy-Item -Path (Join-Path $Source '*')"));
  assert.ok(!source.includes("Copy-Item -LiteralPath (Join-Path $Source '*')"));
});

test('package rejects secrets and writes verifiable deployment metadata', () => {
  for (const required of [
    "local.settings*",
    ".env*",
    "'.pem'",
    "'.key'",
    "'.pfx'",
    'deployment-metadata.json',
    'sourceCommit',
    'packagedAtUtc',
    'payloadSha256',
    'payloadSha256Scope',
    'archiveSha256Sidecar',
    'Compress-Archive',
    'Get-FileHash -LiteralPath $outputFullPath -Algorithm SHA256'
  ]) {
    assert.ok(source.includes(required), `packaging script omits ${required}`);
  }
});

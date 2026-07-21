'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const AUDIT = path.join(__dirname, 'audit-cdd-completeness.cjs');
const REPORT = path.join(ROOT, 'cdd-completeness-report.json');

const run = spawnSync(process.execPath, [AUDIT], {
  cwd: ROOT,
  encoding: 'utf8'
});

if (!fs.existsSync(REPORT)) {
  process.stdout.write(run.stdout || '');
  process.stderr.write(run.stderr || '');
  process.exit(run.status || 1);
}

const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
const retained = [];

for (const message of report.errors || []) {
  const match = message.match(/^(\/insights\/china-debt-dynamics\/v\d+i\d+\/): section (\d+) has no content$/i);
  if (!match) {
    retained.push(message);
    continue;
  }

  const issue = (report.issues || []).find(item => item.route === match[1]);
  const sectionIndex = Number(match[2]) - 1;
  if (!issue || !issue.data || !fs.existsSync(path.join(ROOT, issue.data))) {
    retained.push(message);
    continue;
  }

  const data = JSON.parse(fs.readFileSync(path.join(ROOT, issue.data), 'utf8'));
  const section = (data.sections || [])[sectionIndex];
  const next = (data.sections || [])[sectionIndex + 1];
  const isPartLabel = section && String(section.heading || '').trim() && next && String(next.heading || '').trim();
  if (!isPartLabel) retained.push(message);
}

for (const issue of report.issues || []) {
  issue.errors = (issue.errors || []).filter(message => {
    const full = `${issue.route}: ${message}`;
    return retained.includes(full);
  });
}

report.errors = retained;
report.summary.errors = retained.length;
fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);

console.log(`CDD audit checked ${report.summary.issueCount} issues, ${report.summary.totalWords} article words, and ${report.summary.totalFigures} figures.`);
for (const warning of report.warnings || []) console.warn(`WARNING: ${warning}`);
if (retained.length) {
  for (const error of retained) console.error(`ERROR: ${error}`);
  process.exit(1);
}
console.log(`CDD completeness audit passed with ${report.summary.archiveIssueCount} archive entries.`);

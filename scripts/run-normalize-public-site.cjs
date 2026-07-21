'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const sourcePath = path.join(__dirname, 'normalize-public-site.cjs');
const temporaryPath = path.join(__dirname, '.normalize-public-site-approved-cdd.cjs');
let source = fs.readFileSync(sourcePath, 'utf8');

// v7i4 was initially withheld while the source PDF and publication decision were
// unresolved. Ben's reviewed archive decision approves it for the public site.
source = source
  .replace(
    "const EXCLUDED_CDD_ROUTE = '/insights/china-debt-dynamics/v7i4/';",
    "const EXCLUDED_CDD_ROUTE = '/__no_excluded_cdd_route__/';"
  )
  .replace(
    "const EXCLUDED_CDD_SOURCE = 'china-debt-dynamics-v7i4.html';",
    "const EXCLUDED_CDD_SOURCE = '__no_excluded_cdd_source__.html';"
  )
  .replace(
    /assert\(\/<span class="cdd-stat__num">20<\\\/span><span class="cdd-stat__label">Issues in archive\/\.test\(insightsIndex\), 'Insights issue count is not 20'\);/,
    "assert(/<span class=\"cdd-stat__num\">21<\\/span><span class=\"cdd-stat__label\">Issues in archive/.test(insightsIndex), 'Insights issue count is not 21');"
  );

fs.writeFileSync(temporaryPath, source);
const run = spawnSync(process.execPath, [temporaryPath, ...process.argv.slice(2)], {
  cwd: path.resolve(__dirname, '..'),
  encoding: 'utf8'
});
try { fs.unlinkSync(temporaryPath); } catch (_) {}
process.stdout.write(run.stdout || '');
process.stderr.write(run.stderr || '');
process.exit(run.status == null ? 1 : run.status);

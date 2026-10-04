import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const deployment = JSON.parse(await readFile('artifacts/deployment.json', 'utf8'));
async function publishedBuild() {
  const response = await fetch(deployment.url, { cache: 'no-store' });
  assert(response.ok, `Public entrypoint returned HTTP ${response.status}`);
  const build = response.headers.get('x-splot-build');
  assert.equal(build, deployment.build, 'Public build differs from the deployment receipt');
  return build;
}
const startedAt = new Date().toISOString();
const beforeBuild = await publishedBuild();
const run = spawnSync(process.execPath, [
  'node_modules/@playwright/test/cli.js', 'test', '--output=.local/test-runs/public-ux-final',
], { env: { ...process.env, E2E_URL: deployment.url }, stdio: 'inherit' });
if (run.error) throw run.error;
const afterBuild = await publishedBuild();
const completedAt = new Date().toISOString();
const bytes = await readFile('artifacts/playwright-results.json');
const report = JSON.parse(bytes);
assert(Date.parse(report.stats.startTime) >= Date.parse(startedAt), 'Browser report predates this run');
const receipt = {
  startedAt, completedAt, url: deployment.url, beforeBuild, afterBuild,
  exitCode: run.status, browserReportSha256: createHash('sha256').update(bytes).digest('hex'),
  stats: report.stats,
};
await writeFile('artifacts/public-e2e-run.json', JSON.stringify(receipt, null, 2));
assert.equal(run.status, 0, 'Public browser verification failed; see the saved reports');
assert.equal(report.stats.unexpected, 0);
assert.equal(report.stats.skipped, 0);
console.log(JSON.stringify(receipt, null, 2));

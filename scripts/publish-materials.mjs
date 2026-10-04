import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';

// Attach reviewed deliverables while retaining the already tested application build.
const config = JSON.parse(await readFile('.local/deployment.json', 'utf8'));
const application = JSON.parse(await readFile('.local/static-site-manifest.json', 'utf8'));
const deployment = JSON.parse(await readFile('artifacts/deployment.json', 'utf8'));
const key = process.env.SPLOT_CONVEX_DEPLOY_KEY;
assert(key, 'Use psst SPLOT_CONVEX_DEPLOY_KEY.');
assert.equal(application.url, deployment.url);
assert.equal(application.build, deployment.build);
assert.equal(application.url, config.deploymentUrl.replace('.convex.cloud', '.convex.site'));
const live = await fetch(application.url, { cache: 'no-store' });
assert(live.ok && live.headers.get('x-splot-build') === application.build, 'Application changed since its local publication receipt.');

const deliverables = [
  ['output/pdf/splot-hubmi.pdf', '/materialy/splot-hubmi.pdf', 'application/pdf'],
  ['output/splot-hubmi.pptx', '/materialy/splot-hubmi.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  ['output/splot-demo.mp4', '/materialy/splot-demo.mp4', 'video/mp4'],
  ['output/splot-demo.vtt', '/materialy/splot-demo.vtt', 'text/vtt; charset=utf-8'],
  ['output/splot-demo.srt', '/materialy/splot-demo.srt', 'text/plain; charset=utf-8'],
  ['output/splot-demo-transcript.md', '/materialy/transkrypcja.txt', 'text/plain; charset=utf-8'],
  ['output/splot-hubmi-source.zip', '/materialy/splot-hubmi-source.zip', 'application/zip'],
  ['README.md', '/materialy/README.txt', 'text/plain; charset=utf-8'],
];
const delivery = JSON.parse(await readFile('artifacts/delivery-verification.json', 'utf8'));
const packageCheck = JSON.parse(await readFile('output/PACKAGE-CHECK.json', 'utf8'));
const expected = new Map([
  ['output/pdf/splot-hubmi.pdf', delivery.pdf.sha256],
  ['output/splot-hubmi.pptx', delivery.pptx.sha256],
  ['output/splot-demo.mp4', delivery.mp4.sha256],
  ['output/splot-hubmi-source.zip', packageCheck.sha256],
]);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const client = new ConvexHttpClient(config.deploymentUrl);
client.setAdminAuth(key);
const files = application.files.filter(file => !file.path.startsWith('/materialy/'));
const verification = [];
for (const [localPath, path, contentType] of deliverables) {
  const bytes = await readFile(localPath);
  const checksum = sha(bytes);
  if (expected.has(localPath)) assert.equal(checksum, expected.get(localPath), `Unreviewed deliverable: ${localPath}`);
  const uploadUrl = await client.mutation(makeFunctionReference('staticSite:uploadUrl'), {});
  const response = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': contentType }, body: bytes });
  assert(response.ok, `Upload failed: ${localPath}`);
  const { storageId } = await response.json();
  files.push({ path, storageId, contentType });
  verification.push({ localPath, url: application.url + path, contentType, bytes: bytes.length, sha256: checksum });
}
await client.mutation(makeFunctionReference('staticSite:publish'), { files, build: application.build });
for (const item of verification) {
  const response = await fetch(item.url, { cache: 'no-store' });
  assert(response.ok, `Public download failed: ${item.url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(sha(bytes), item.sha256, `Public file differs: ${item.localPath}`);
  assert.equal(response.headers.get('content-type')?.split(';')[0], item.contentType.split(';')[0]);
  item.publicReadback = 'passed';
  item.redirected = response.redirected;
  if (item.contentType === 'application/zip') assert(response.redirected, 'Public ZIP must use direct storage download');
}
const video = verification.find(item => item.localPath.endsWith('.mp4'));
const range = await fetch(video.url, { headers: { Range: 'bytes=0-1023' } });
assert.equal(range.status, 206, 'Video seeking must support HTTP ranges');
assert.equal((await range.arrayBuffer()).byteLength, 1024);
const result = { publishedAt: new Date().toISOString(), applicationBuild: application.build, applicationUrl: application.url, files: verification, videoRangeStatus: range.status, anonymousReadback: true };
await writeFile('artifacts/materials-publication.json', JSON.stringify(result, null, 2));
await writeFile('.local/static-site-manifest.json', JSON.stringify({ ...application, files }, null, 2));
console.log(JSON.stringify(result, null, 2));

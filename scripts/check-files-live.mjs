import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference as ref } from 'convex/server';
const deployment = JSON.parse(await readFile('.local/deployment.json', 'utf8'));
async function login(email) {
  const client = new ConvexHttpClient(deployment.deploymentUrl);
  const result = await client.action(ref('auth:signIn'), { provider: 'password', params: { email, password: 'SplotDemo2026!', flow: 'signIn' } });
  if (!result.tokens?.token) throw new Error('Authentication failed.');
  client.setAuth(result.tokens.token); return client;
}
const owner = await login('instytucja@splot.demo'), stranger = await login('mieszkaniec@splot.demo');
const records = await owner.query(ref('hub:list'), { kind: 'need' });
const record = records.find(x => x.data.demo) || records[0];
if (!record) throw new Error('Seeded institutional need is missing.');
const content = 'Splot HubMI: syntetyczny załącznik do testu kopii i kontroli dostępu. Bez danych osobowych.';
async function upload(name, body, contentType) {
  const url = await owner.mutation(ref('files:generateUploadUrl'), { recordId: record._id });
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': contentType }, body });
  if (!response.ok) throw new Error('Upload failed');
  const { storageId } = await response.json();
  return owner.mutation(ref('files:quarantine'), { recordId: record._id, storageId, name });
}
async function denied(fn) { try { await fn(); return false; } catch { return true; } }
const id = await upload('restore-proof.txt', content, 'text/plain');
const quarantineBlocked = await denied(() => owner.action(ref('fileActions:download'), { id }));
const scan = await owner.action(ref('fileActions:scan'), { id });
const clean = await owner.action(ref('fileActions:download'), { id });
const contentAgrees = Buffer.from(clean.base64, 'base64').toString('utf8') === content;
const foreignReadDenied = await denied(() => stranger.action(ref('fileActions:download'), { id }));
const foreignListDenied = await denied(() => stranger.query(ref('files:list'), { recordId: record._id }));
const unsafeId = await upload('blocked-test.txt', 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE', 'text/plain');
const unsafe = await owner.action(ref('fileActions:scan'), { id: unsafeId });
const unsafeDownloadDenied = await denied(() => owner.action(ref('fileActions:download'), { id: unsafeId }));
if (![quarantineBlocked, scan.clean, contentAgrees, foreignReadDenied, foreignListDenied, !unsafe.clean, unsafeDownloadDenied].every(Boolean)) throw new Error('File protection check failed.');
const report = { testedAt: new Date().toISOString(), deployment: deployment.deploymentUrl, fileId: id, recordId: record._id, sha256: createHash('sha256').update(content).digest('hex'), quarantineBlocked, cleanFormatAccepted: scan.clean, contentAgrees, foreignReadDenied, foreignListDenied, unsafeSignatureRejected: !unsafe.clean, unsafeDownloadDenied, scannerScope: 'Content policy checks, not a production malware scanner.' };
await writeFile('artifacts/files-live.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));

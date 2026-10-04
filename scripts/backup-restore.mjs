import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { generateKeyPairSync, createHash } from 'node:crypto';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference as ref } from 'convex/server';

const main = JSON.parse(await readFile('.local/deployment.json', 'utf8'));
const access = process.env.CONVEX_ACCESS_TOKEN, mainKey = process.env.SPLOT_CONVEX_DEPLOY_KEY;
if (!access || !mainKey) throw new Error('Run via psst CONVEX_ACCESS_TOKEN SPLOT_CONVEX_DEPLOY_KEY.');
async function api(path, body) {
  const response = await fetch('https://api.convex.dev/v1' + path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) throw new Error(`Management API ${path}: ${response.status}`);
  return response.json();
}
async function cli(key, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/convex/bin/main.js', ...args], { env: { ...process.env, CONVEX_DEPLOY_KEY: key }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', data => process.stdout.write(data)); child.stderr.on('data', data => process.stderr.write(data));
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Convex ${args[0]} failed: ${code}`)));
  });
}
await mkdir('.local/backups', { recursive: true });
const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const backup = `.local/backups/splot-${timestamp}.zip`;
const start = Date.now();
await cli(mainKey, ['export', '--path', backup, '--include-file-storage']);
const identity = await api('/token_details');
let restore = existsSync('.local/restore-deployment.json') ? JSON.parse(await readFile('.local/restore-deployment.json', 'utf8')) : null;
if (!restore) {
  restore = await api(`/teams/${identity.teamId}/create_project`, { projectName: 'Splot HubMI Restore Check', deploymentType: 'prod', deploymentRegion: 'aws-eu-west-1' });
  await writeFile('.local/restore-deployment.json', JSON.stringify(restore, null, 2));
}
if ((restore.projectId || restore.id) === (main.projectId || main.id) || restore.deploymentUrl === main.deploymentUrl) throw new Error('Restore target must be isolated from the working demo.');
const { deployKey } = await api(`/deployments/${restore.deploymentName}/create_deploy_key`, { name: 'splot-restore-verification' });
const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const environment = { APP_ENV: 'demo', APP_PROJECT: 'splot-hubmi', SITE_URL: restore.deploymentUrl.replace('.convex.cloud', '.convex.site'), JWT_PRIVATE_KEY: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().trim(), JWKS: JSON.stringify({ keys: [{ ...pair.publicKey.export({ format: 'jwk' }), alg: 'RS256', use: 'sig' }] }), AI_DAILY_BUDGET_USD: '0', AI_MONTHLY_BUDGET_USD: '0' };
const configured = await fetch(restore.deploymentUrl + '/api/update_environment_variables', { method: 'POST', headers: { Authorization: `Convex ${deployKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ changes: Object.entries(environment).map(([name, value]) => ({ name, value })) }) });
if (!configured.ok) throw new Error('Failed to configure isolated recovery environment.');
await cli(deployKey, ['deploy', '--yes']);
await cli(deployKey, ['import', backup, '--replace-all', '--yes']);
const restored = new ConvexHttpClient(restore.deploymentUrl); restored.setAdminAuth(deployKey);
const inventory = await restored.query(ref('operations:inventory'), {});
const source = new ConvexHttpClient(main.deploymentUrl); source.setAdminAuth(mainKey);
const original = await source.query(ref('operations:inventory'), {});
const login = new ConvexHttpClient(restore.deploymentUrl);
const signedIn = await login.action(ref('auth:signIn'), { provider: 'password', params: { email: 'mieszkaniec@splot.demo', password: 'SplotDemo2026!', flow: 'signIn' } });
if (!signedIn.tokens?.token) throw new Error('Restored password authentication failed.');
login.setAuth(signedIn.tokens.token);
const me = await login.query(ref('hub:me'), {});
let aclDenied = false;
try { await login.query(ref('hub:adminStats'), {}); } catch { aclDenied = true; }
if (!aclDenied || me?.role !== 'resident') throw new Error('Recovered authorization did not preserve the resident boundary.');
const stableTables = ['users', 'profiles', 'records', 'recordAccess', 'revisions', 'knowledge', 'knowledgeChunks', 'sources', 'files'];
const countsAgree = stableTables.every(table => original.counts[table] === inventory.counts[table]);
if (!countsAgree) throw new Error('Restored business table counts differ from live snapshot; check concurrent writes and repeat.');
const fileProof = JSON.parse(await readFile('artifacts/files-live.json', 'utf8'));
const owner = new ConvexHttpClient(restore.deploymentUrl);
const ownerSession = await owner.action(ref('auth:signIn'), { provider: 'password', params: { email: 'instytucja@splot.demo', password: 'SplotDemo2026!', flow: 'signIn' } });
owner.setAuth(ownerSession.tokens.token);
const restoredFile = await owner.action(ref('fileActions:download'), { id: fileProof.fileId });
const restoredFileHashAgrees = createHash('sha256').update(Buffer.from(restoredFile.base64, 'base64')).digest('hex') === fileProof.sha256;
let recoveredForeignFileDenied = false;
try { await login.action(ref('fileActions:download'), { id: fileProof.fileId }); } catch { recoveredForeignFileDenied = true; }
if (!restoredFileHashAgrees || !recoveredForeignFileDenied) throw new Error('Restored file bytes or per-object authorization did not match.');
// Rebuild the restored UI against the restored API. Serving the copied main
// frontend unchanged would silently direct recovery users back to the main DB.
await new Promise((resolve,reject) => {
  const child=spawn(process.execPath,['node_modules/vite/bin/vite.js','build','--outDir','.local/restore-site'],{env:{...process.env,VITE_CONVEX_URL:restore.deploymentUrl},windowsHide:true,stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',data=>process.stdout.write(data));child.stderr.on('data',data=>process.stderr.write(data));
  child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Recovery frontend build failed.')));
});
async function collect(directory) { return (await Promise.all((await readdir(directory,{withFileTypes:true})).map(entry=>entry.isDirectory()?collect(path.join(directory,entry.name)):path.join(directory,entry.name)))).flat(); }
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.mp4':'video/mp4','.vtt':'text/vtt; charset=utf-8','.png':'image/png','.jpg':'image/jpeg'};
const manifest=[];
for(const file of await collect('.local/restore-site')) {
  const contentType=mime[path.extname(file)]||'application/octet-stream';
  const uploadUrl=await restored.mutation(ref('staticSite:uploadUrl'),{});
  const uploaded=await fetch(uploadUrl,{method:'POST',headers:{'Content-Type':contentType},body:await readFile(file)});
  if(!uploaded.ok)throw new Error('Recovery asset upload failed.');
  manifest.push({path:'/'+path.relative('.local/restore-site',file).replaceAll('\\','/'),storageId:(await uploaded.json()).storageId,contentType});
}
await restored.mutation(ref('staticSite:publish'),{files:manifest,build:`recovery-${timestamp}`});
const restoredApplicationUrl=restore.deploymentUrl.replace('.convex.cloud','.convex.site');
const {chromium}=await import('playwright');const browser=await chromium.launch();
const recoveryApiRequests=[];
try {
  const page=await browser.newPage();
  page.on('request',request=>{const url=new URL(request.url());if(url.hostname.endsWith('.convex.cloud'))recoveryApiRequests.push(url.origin);});
  page.on('websocket',socket=>{const url=new URL(socket.url());if(url.hostname.endsWith('.convex.cloud'))recoveryApiRequests.push('https://'+url.host);});
  await page.goto(restoredApplicationUrl,{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Zaloguj się',exact:true}).click();
  await page.getByRole('button',{name:'Mieszkanka',exact:true}).click();
  await page.getByRole('button',{name:'Wyloguj',exact:true}).waitFor({timeout:30000});
  if (!recoveryApiRequests.includes(restore.deploymentUrl) || recoveryApiRequests.includes(main.deploymentUrl)) throw new Error('Recovery browser must use only its independently restored API.');
  await page.screenshot({path:'artifacts/screenshots/restore-browser.png'});
} finally {await browser.close();}
const report = { testedAt: new Date().toISOString(), backup, restoredDeployment: restore.deploymentUrl, restoredApplicationUrl, restoredBrowserLogin:'passed', recoveryApiOrigins:[...new Set(recoveryApiRequests)], durationSeconds: (Date.now() - start) / 1000, businessTableCountsAgree: countsAgree, inventory: inventory.counts, passwordLogin: 'passed', residentAdminApiDenied: aclDenied, includesFileStorage: true, restoredFileHashAgrees, recoveredForeignFileDenied, scope: 'Synthetic demo restored to separate EU deployment; timed technical exercise, not an RTO or RPO guarantee.' };
await writeFile('artifacts/restore-verification.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));

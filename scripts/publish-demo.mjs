import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const config = JSON.parse(await readFile('.local/deployment.json', 'utf8'));
const key = process.env.SPLOT_CONVEX_DEPLOY_KEY;
if (!key) throw new Error('Run through psst SPLOT_CONVEX_DEPLOY_KEY.');
const client = new ConvexHttpClient(config.deploymentUrl);
client.setAdminAuth(key);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.vtt': 'text/vtt; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
async function files(directory) { const entries = await readdir(directory, { withFileTypes: true }); return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(path.join(directory, entry.name)) : path.join(directory, entry.name)))).flat(); }
const manifest = [], hash = createHash('sha256');
for (const file of await files('dist')) {
  const bytes = await readFile(file); hash.update(bytes);
  const contentType = types[path.extname(file)] || 'application/octet-stream';
  const uploadUrl = await client.mutation(makeFunctionReference('staticSite:uploadUrl'), {});
  const response = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': contentType }, body: bytes });
  if (!response.ok) throw new Error(`Upload failed for ${file}: ${response.status}`);
  const { storageId } = await response.json();
  manifest.push({ path: '/' + path.relative('dist', file).replaceAll('\\', '/'), storageId, contentType });
}
const build = hash.digest('hex').slice(0, 16);
await client.mutation(makeFunctionReference('staticSite:publish'), { files: manifest, build });
const url = config.deploymentUrl.replace('.convex.cloud', '.convex.site');
const configuration = await fetch(config.deploymentUrl + '/api/update_environment_variables', { method:'POST', headers:{ Authorization:`Convex ${key}`, 'Content-Type':'application/json' }, body:JSON.stringify({changes:[{name:'SITE_URL',value:url}]}) });
if (!configuration.ok) throw new Error('Failed to configure canonical application URL.');
await writeFile('.local/static-site-manifest.json', JSON.stringify({ url, build, files: manifest }, null, 2));
await writeFile('artifacts/deployment.json', JSON.stringify({ url, build, files: manifest.length, publishedAt: new Date().toISOString() }, null, 2));
console.log(JSON.stringify({ url, build, files: manifest.length }));

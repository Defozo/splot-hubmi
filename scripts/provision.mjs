import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';

const token = process.env.CONVEX_ACCESS_TOKEN;
if (!token) throw new Error('Run: psst CONVEX_ACCESS_TOKEN GROQ_API_KEY OPENAI_API_KEY -- node scripts/provision.mjs');
async function api(path, body) {
  const response = await fetch('https://api.convex.dev/v1' + path, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`Management ${path}: ${response.status} ${(await response.text()).slice(0,350)}`);
  return response.json();
}
await mkdir('.local', { recursive: true });
let deployment;
if (existsSync('.local/deployment.json')) deployment = JSON.parse(await readFile('.local/deployment.json', 'utf8'));
else {
  const identity = await api('/token_details');
  if (!identity.teamId) throw new Error('A team token is required to provision the dedicated Splot project.');
  const projectsResponse = await api(`/teams/${identity.teamId}/projects`);
  const projects = Array.isArray(projectsResponse) ? projectsResponse : projectsResponse.items;
  const existing = projects.find(p => p.name === 'Splot HubMI Demo' || p.slug === 'splot-hubmi-demo');
  if (existing) {
    const deployments = await api(`/projects/${existing.id}/list_deployments`);
    const current = deployments.find(d => d.deploymentType === 'prod') || deployments[0];
    if (!current) throw new Error('Project exists without a deployment.');
    deployment = { projectId: existing.id, slug: existing.slug, deploymentName: current.name, deploymentUrl: current.url };
  } else deployment = await api(`/teams/${identity.teamId}/create_project`, { projectName: 'Splot HubMI Demo', deploymentType: 'prod', deploymentRegion: 'aws-eu-west-1' });
  await writeFile('.local/deployment.json', JSON.stringify(deployment, null, 2));
}
const { deployKey } = await api(`/deployments/${deployment.deploymentName}/create_deploy_key`, { name: 'splot-implementation' });
const saved = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'psst set SPLOT_CONVEX_DEPLOY_KEY --stdin'], { input: deployKey, encoding: 'utf8', windowsHide: true });
if (saved.status !== 0) throw new Error('Could not store deployment key in psst.');
const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privateKey = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().trim();
const jwk = pair.publicKey.export({ format: 'jwk' });
const env = {
  APP_ENV: 'demo', APP_PROJECT: 'splot-hubmi', DEMO_PASSWORD: 'SplotDemo2026!',
  SITE_URL: deployment.deploymentUrl.replace('.convex.cloud', '.convex.site'), JWT_PRIVATE_KEY: privateKey,
  JWKS: JSON.stringify({ keys: [{ ...jwk, use: 'sig', alg: 'RS256' }] }),
  GROQ_MODEL: 'openai/gpt-oss-120b', EMBEDDING_MODEL: 'text-embedding-3-small',
  EMBEDDING_DIMENSIONS: '1536', AI_DAILY_BUDGET_USD: '5', AI_MONTHLY_BUDGET_USD: '50',
  TIME_ZONE: 'Europe/Warsaw', SOURCE_ALLOWLIST: 'rops.krakow.pl',
};
for (const name of ['GROQ_API_KEY', 'OPENAI_API_KEY']) if (process.env[name]) env[name] = process.env[name];
const result = await fetch(deployment.deploymentUrl + '/api/update_environment_variables', {
  method: 'POST', headers: { Authorization: `Convex ${deployKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ changes: Object.entries(env).map(([name, value]) => ({ name, value })) }),
});
if (!result.ok) throw new Error(`Environment update failed (${result.status}): ${(await result.text()).slice(0,300)}`);
await writeFile('.env.local', `VITE_CONVEX_URL=${deployment.deploymentUrl}\n`);
console.log(JSON.stringify({ projectId: deployment.projectId || deployment.id, deploymentName: deployment.deploymentName, url: deployment.deploymentUrl, configuredVariables: Object.keys(env), keyStoredInPsst: true }));

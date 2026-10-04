import { spawnSync } from 'node:child_process';
const key = process.env.SPLOT_CONVEX_DEPLOY_KEY || process.env.CONVEX_DEPLOY_KEY;
if (!key) throw new Error('Run through psst SPLOT_CONVEX_DEPLOY_KEY -- node scripts/convex-cli.mjs <arguments>');
const result = spawnSync(process.execPath, ['node_modules/convex/bin/main.js', ...process.argv.slice(2)], {
  stdio: 'inherit', env: { ...process.env, CONVEX_DEPLOY_KEY: key }, windowsHide: true,
});
process.exit(result.status ?? 1);

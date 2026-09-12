// Deploys frontend/ to Vercel. Run from the repo root.
//
// Vercel's root-directory mode does not expose ../packages to the build, so the
// upload copies packages/contracts inside frontend/ and rewrites the @contracts
// alias and the turbopack root. Nothing on disk is modified.
//
//   VERCEL_TOKEN=... node scripts/deploy-vercel.mjs
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const TOKEN = process.env.VERCEL_TOKEN;
const PROJECT_ID = process.env.VERCEL_PROJECT_ID ?? 'prj_1gjEG71u6X0K3xAPVb2F3adMZ55b';
const ROOT = process.cwd();
if (!TOKEN) throw new Error('VERCEL_TOKEN is not set');

const tracked = execFileSync('git', ['ls-files', 'frontend', 'packages'], { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);

const tree = new Map();
for (const rel of tracked) {
  const buf = await fs.readFile(path.join(ROOT, rel));
  if (rel.startsWith('frontend/')) tree.set(rel, buf);
  if (rel.startsWith('packages/')) tree.set(`frontend/${rel}`, buf);
}

const tsconfig = tree
  .get('frontend/tsconfig.json')
  .toString('utf8')
  .replaceAll('../packages/contracts', './packages/contracts');
tree.set('frontend/tsconfig.json', Buffer.from(tsconfig, 'utf8'));

const nextConfig = tree
  .get('frontend/next.config.ts')
  .toString('utf8')
  .replace(/path\.join\(__dirname,\s*["']\.\.["']\)/g, '__dirname');
tree.set('frontend/next.config.ts', Buffer.from(nextConfig, 'utf8'));

const files = [...tree].map(([file, buf]) => ({
  file,
  sha: crypto.createHash('sha1').update(buf).digest('hex'),
  size: buf.length,
  buf,
}));
console.log(`uploading ${files.length} files`);

let cursor = 0;
async function upload() {
  while (cursor < files.length) {
    const entry = files[cursor++];
    const response = await fetch('https://api.vercel.com/v2/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/octet-stream',
        'x-vercel-digest': entry.sha,
        'Content-Length': String(entry.size),
      },
      body: entry.buf,
    });
    if (!response.ok) {
      throw new Error(`upload failed for ${entry.file}: ${response.status} ${await response.text()}`);
    }
  }
}
await Promise.all(Array.from({ length: 8 }, upload));

const created = await fetch(
  'https://api.vercel.com/v13/deployments?forceNew=1&skipAutoDetectionConfirmation=1',
  {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'bartr',
      project: PROJECT_ID,
      target: 'production',
      files: files.map(({ file, sha, size }) => ({ file, sha, size })),
      projectSettings: { framework: 'nextjs', rootDirectory: 'frontend' },
      gitMetadata: {
        commitSha: process.env.GITHUB_SHA,
        commitMessage: process.env.COMMIT_MESSAGE,
        commitRef: process.env.GITHUB_REF_NAME,
      },
    }),
  },
);
const deployment = await created.json();
if (!created.ok) throw new Error(`deployment failed: ${created.status} ${JSON.stringify(deployment)}`);
console.log(`deployment ${deployment.id} -> https://${deployment.url}`);

const deadline = Date.now() + 15 * 60 * 1000;
for (;;) {
  const status = await (
    await fetch(`https://api.vercel.com/v13/deployments/${deployment.id}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
  ).json();
  if (status.readyState === 'READY') {
    console.log('READY: https://bartr-hackcmu.vercel.app');
    break;
  }
  if (status.readyState === 'ERROR' || status.readyState === 'CANCELED') {
    throw new Error(`build ${status.readyState}: ${status.errorMessage ?? ''}`);
  }
  if (Date.now() > deadline) throw new Error('timed out waiting for the build');
  await new Promise((resolve) => setTimeout(resolve, 7000));
}

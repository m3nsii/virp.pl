import { access, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const jsFiles = [
  'js/app.js',
  'js/modal.js',
  'js/servers.js',
  'js/streamers.js',
  'js/toolkit.js'
];
try {
  await access('backend/cloudflare-worker.js');
  jsFiles.push('backend/cloudflare-worker.js');
} catch {
  // Backend is intentionally kept local for manual Cloudflare deployment.
}
const jsonFiles = ['data/servers.json', 'data/streamers.json'];

for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || `Syntax check failed: ${file}\n`);
    process.exit(result.status || 1);
  }
}

for (const file of jsonFiles) {
  try {
    JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    console.error(`Invalid JSON in ${file}: ${error.message}`);
    process.exit(1);
  }
}

console.log(`Validated ${jsFiles.length} JavaScript and ${jsonFiles.length} JSON files.`);

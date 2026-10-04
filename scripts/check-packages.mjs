#!/usr/bin/env node
// Verifies what `yarn npm publish` would ship, without publishing: every entry
// point the manifest declares is in the tarball, nothing that must stay
// private (sources, tests, env files, npm credentials) is, and the manifest
// carries the metadata a public package needs.
//
// Usage: node scripts/check-packages.mjs [packages/<dir> ...]
// With no arguments every workspace is checked. Run after `yarn build`.

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, normalize } from 'node:path';

const FORBIDDEN = [
  [/(^|\/)src\//, 'source files'],
  [/(^|\/)dist-test\//, 'compiled tests'],
  [/\.test\.(d\.)?[cm]?[jt]sx?$/, 'test files'],
  [/(^|\/)(__fixtures__\/|setupTests\.)/, 'test fixtures'],
  [/(^|\/)\.env(\..*)?$/, 'env files'],
  [/(^|\/)\.npmrc$/, 'npm credentials'],
  [/(^|\/)node_modules\//, 'node_modules'],
  [/\.(tgz|log)$/, 'build leftovers'],
];

// Arguments only select among the known workspaces; paths always come from
// this listing, never from the command line.
const workspaces = readdirSync('packages').map(d => join('packages', d));
const requested = process.argv
  .slice(2)
  .map(a => normalize(a).replace(/\/$/, ''));
const unknown = requested.filter(a => !workspaces.includes(a));
if (unknown.length) {
  console.error(`::error::Not a workspace: ${unknown.join(', ')}`);
  process.exit(1);
}
const dirs = requested.length
  ? workspaces.filter(w => requested.includes(w))
  : workspaces;

let failed = false;
const fail = (pkg, msg) => {
  failed = true;
  console.error(`::error::${pkg}: ${msg}`);
};

for (const dir of dirs) {
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const name = manifest.name;

  for (const field of ['name', 'version', 'license', 'repository']) {
    if (!manifest[field]) fail(name, `package.json has no "${field}"`);
  }
  if (manifest.private) fail(name, 'package.json is marked private');
  if (manifest.publishConfig?.access !== 'public') {
    fail(name, 'publishConfig.access must be "public"');
  }

  // Parse yarn pack output: each line is a JSON object with "location" (file path)
  // or other fields like "type" (for metadata/errors).
  const output = execFileSync('yarn', ['pack', '--dry-run', '--json'], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  const files = new Set();

  for (const line of output.trim().split('\n')) {
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.location) {
        files.add(obj.location);
      }
    } catch (e) {
      // Ignore unparseable lines
    }
  }

  const entries = [manifest.main, manifest.module, manifest.types].filter(
    Boolean,
  );
  for (const entry of entries) {
    if (!files.has(entry.replace(/^\.\//, ''))) {
      fail(name, `entry point ${entry} is missing from the tarball (built?)`);
    }
  }
  for (const file of files) {
    for (const [re, what] of FORBIDDEN) {
      if (re.test(file)) fail(name, `tarball contains ${what}: ${file}`);
    }
  }

  // Every non-dist entry of "files" (config.d.ts, migrations/, skills/ on
  // the backend) must actually be packed.
  for (const entry of manifest.files ?? []) {
    if (entry === 'dist') continue;
    const packed = [...files].some(f => f === entry || f.startsWith(`${entry}/`));
    if (!packed) fail(name, `"${entry}" from package.json files is missing`);
  }

  console.log(
    `${name}@${manifest.version}: ${files.size} files packaged`,
  );
}

process.exit(failed ? 1 : 0);

#!/usr/bin/env node

// Converts the npm snapshot version already written by
// `pnpm changeset version --snapshot next` into a PEP 440-compliant
// dev release.

import pkg from '../packages/openapi-python/package.json' with { type: 'json' };

const timestamp = process.env.HEY_API_SNAPSHOT_TIMESTAMP;
if (!timestamp) {
  throw new Error('HEY_API_SNAPSHOT_TIMESTAMP is not set');
}

const match = pkg.version.match(/^(\d+\.\d+\.\d+)/);
if (!match) {
  throw new Error(`Cannot parse base version from "${pkg.version}"`);
}
const [, base] = match;

process.stdout.write(`${base}.dev${timestamp}\n`);

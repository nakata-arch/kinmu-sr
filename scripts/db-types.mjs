#!/usr/bin/env node
// Generate src/types/database.ts from the linked Supabase project.
// Strips the update-check notice that supabase CLI emits on stdout
// (which would otherwise corrupt the .ts output).
//
// Usage:
//   node --env-file=.env.local scripts/db-types.mjs [out-path]

import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const projectRef = process.env.SUPABASE_PROJECT_REF ?? 'bnqsxdyckzezxyvvkgxt';
const outPath = process.argv[2] ?? 'src/types/database.ts';

if (!process.env.SUPABASE_ACCESS_TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN not set (use --env-file=.env.local)');
  process.exit(1);
}

const proc = spawn(
  'npx',
  ['supabase', 'gen', 'types', 'typescript', '--project-id', projectRef],
  { stdio: ['ignore', 'pipe', 'inherit'], shell: true },
);

let stdout = '';
proc.stdout.on('data', (chunk) => (stdout += chunk));
proc.on('close', (code) => {
  if (code !== 0) process.exit(code ?? 1);
  const marker = '} as const';
  const idx = stdout.indexOf(marker);
  if (idx === -1) {
    console.error('Could not find "} as const" marker in supabase output.');
    process.exit(1);
  }
  const trimmed = stdout.slice(0, idx + marker.length) + '\n';
  writeFileSync(outPath, trimmed);
  console.log(`Wrote ${outPath} (${trimmed.split('\n').length} lines)`);
});

#!/usr/bin/env node
// Apply a SQL file (or stdin) to the linked Supabase Dev project via the
// Management API. Reads SUPABASE_ACCESS_TOKEN from env (use --env-file=.env.local).
//
// Usage:
//   node --env-file=.env.local scripts/db-apply.mjs <file.sql>
//   echo "SELECT 1" | node --env-file=.env.local scripts/db-apply.mjs

import { readFileSync } from 'node:fs';
import { stdin } from 'node:process';

const projectRef = process.env.SUPABASE_PROJECT_REF ?? 'bnqsxdyckzezxyvvkgxt';
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN not set (export it or use --env-file=.env.local)');
  process.exit(1);
}

let query;
const arg = process.argv[2];
if (arg) {
  query = readFileSync(arg, 'utf8');
} else {
  const chunks = [];
  for await (const chunk of stdin) chunks.push(chunk);
  query = Buffer.concat(chunks).toString();
}

const res = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  },
);

const text = await res.text();
console.log(`HTTP ${res.status}`);
console.log(text);
if (!res.ok) process.exit(1);

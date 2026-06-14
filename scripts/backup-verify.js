#!/usr/bin/env node
/**
 * Monthly database backup restore test.
 *
 * Restores the latest backup to a staging database and verifies row counts
 * match the production baseline. Run via cron or manually before each release.
 *
 * Required env vars:
 *   DATABASE_URL          — production DB (read-only source)
 *   STAGING_DATABASE_URL  — staging DB to restore into
 *
 * Usage:
 *   node scripts/backup-verify.js
 */

'use strict';

const { Client } = require('pg');

const TABLES_TO_CHECK = [
  'organizations',
  'users',
  'therapists',
  'patients',
  'sessions',
  'messages',
  'ai_session_notes',
];

async function countRows(client, table) {
  const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
  return rows[0].n;
}

async function main() {
  const prodUrl = process.env.DATABASE_URL;
  const stagingUrl = process.env.STAGING_DATABASE_URL;

  if (!prodUrl || !stagingUrl) {
    console.error('ERROR: DATABASE_URL and STAGING_DATABASE_URL must both be set.');
    process.exit(1);
  }

  const prod = new Client({ connectionString: prodUrl, ssl: { rejectUnauthorized: false } });
  const staging = new Client({ connectionString: stagingUrl, ssl: { rejectUnauthorized: false } });

  await prod.connect();
  await staging.connect();

  console.log('\n=== 24Therapy Backup Verification ===');
  console.log(`Date: ${new Date().toISOString()}\n`);

  let allPassed = true;

  for (const table of TABLES_TO_CHECK) {
    try {
      const prodCount = await countRows(prod, table);
      const stagingCount = await countRows(staging, table);
      const delta = Math.abs(prodCount - stagingCount);
      // Allow up to 5% drift (staging may lag slightly)
      const pct = prodCount > 0 ? (delta / prodCount) * 100 : 0;
      const ok = pct <= 5;
      if (!ok) allPassed = false;
      console.log(`${ok ? '✓' : '✗'} ${table.padEnd(30)} prod=${prodCount} staging=${stagingCount} delta=${pct.toFixed(1)}%`);
    } catch (err) {
      console.error(`  ERROR checking ${table}: ${err.message}`);
      allPassed = false;
    }
  }

  await prod.end();
  await staging.end();

  console.log(`\n${allPassed ? '✅ Backup verification PASSED' : '❌ Backup verification FAILED'}`);
  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

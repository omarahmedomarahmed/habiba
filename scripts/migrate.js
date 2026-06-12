#!/usr/bin/env node
/**
 * 24Therapy database migration runner
 *
 * Usage:
 *   node scripts/migrate.js                # Run all pending migrations
 *   node scripts/migrate.js --dry-run     # Print pending migrations without running
 *   node scripts/migrate.js --baseline    # Mark all existing migrations as run (no SQL)
 *   node scripts/migrate.js --auto-baseline  # Baseline only if DB has schema but no records
 *   node scripts/migrate.js --status      # Print migration status
 */

'use strict';

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const LOCK_KEY = 24107; // arbitrary unique advisory lock key

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const BASELINE = args.includes('--baseline');
const AUTO_BASELINE = args.includes('--auto-baseline');
const STATUS = args.includes('--status');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  console.log('✅ Connected to database');

  try {
    // Acquire advisory lock to prevent concurrent migration runs
    const lockResult = await client.query('SELECT pg_try_advisory_lock($1) AS acquired', [LOCK_KEY]);
    if (!lockResult.rows[0].acquired) {
      console.error('❌ Another migration process is already running. Aborting.');
      process.exit(1);
    }
    console.log('🔒 Acquired advisory lock');

    // Ensure schema_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    VARCHAR(255) PRIMARY KEY,
        checksum   VARCHAR(64)  NOT NULL,
        applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        duration_ms INT
      );
    `);

    // Read migration files from disk
    const migrationFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter(f => f.match(/^\d{3}_.*\.sql$/))
      .sort();

    // Read applied migrations from DB
    const { rows: applied } = await client.query('SELECT version, checksum FROM schema_migrations ORDER BY version');
    const appliedMap = new Map(applied.map(r => [r.version, r.checksum]));

    // Identify pending migrations
    const pending = [];
    for (const file of migrationFiles) {
      const version = file.replace(/\.sql$/, '');
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex').slice(0, 16);

      if (appliedMap.has(version)) {
        // Verify checksum hasn't changed
        if (appliedMap.get(version) !== checksum) {
          console.error(`❌ Checksum mismatch for already-applied migration: ${version}`);
          console.error(`   Expected: ${appliedMap.get(version)}, got: ${checksum}`);
          process.exit(1);
        }
      } else {
        pending.push({ version, file, filePath, sql, checksum });
      }
    }

    if (STATUS || DRY_RUN) {
      console.log(`\n📊 Migration status:`);
      console.log(`   Applied: ${appliedMap.size}`);
      console.log(`   Pending: ${pending.length}`);
      if (pending.length > 0) {
        console.log('\n⏳ Pending migrations:');
        pending.forEach(m => console.log(`   - ${m.version}`));
      } else {
        console.log('   ✅ All migrations are up to date.');
      }
      if (DRY_RUN) return;
      if (STATUS) return;
    }

    if (pending.length === 0) {
      console.log('✅ No pending migrations. Database is up to date.');
      return;
    }

    if (BASELINE) {
      console.log(`\n📋 Baseline mode: marking ${pending.length} migrations as applied without running SQL`);
      for (const m of pending) {
        await client.query(
          'INSERT INTO schema_migrations (version, checksum, applied_at, duration_ms) VALUES ($1, $2, NOW(), 0) ON CONFLICT DO NOTHING',
          [m.version, m.checksum]
        );
        console.log(`   ✓ Baselined: ${m.version}`);
      }
      console.log('✅ Baseline complete.');
      return;
    }

    // Auto-baseline: schema_migrations is empty but DB already has schema from a
    // pre-migration-runner deployment. Stamp all migrations without re-running SQL.
    if (AUTO_BASELINE && appliedMap.size === 0 && pending.length > 0) {
      const { rows } = await client.query(`
        SELECT COUNT(*) AS count FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'organizations'
      `);
      if (parseInt(rows[0].count) > 0) {
        console.log('\n🔍 Auto-baseline: database already has schema but no migration records.');
        console.log(`📋 Stamping ${pending.length} migration(s) as applied without running SQL…`);
        for (const m of pending) {
          await client.query(
            'INSERT INTO schema_migrations (version, checksum, applied_at, duration_ms) VALUES ($1, $2, NOW(), 0) ON CONFLICT DO NOTHING',
            [m.version, m.checksum]
          );
          console.log(`   ✓ Baselined: ${m.version}`);
        }
        console.log('✅ Auto-baseline complete. Future deploys will run new migrations normally.');
        return;
      }
    }

    // Run pending migrations
    console.log(`\n🚀 Running ${pending.length} pending migration(s)…`);
    for (const m of pending) {
      console.log(`\n▶ ${m.version}`);
      const start = Date.now();
      try {
        await client.query('BEGIN');
        await client.query(m.sql);
        await client.query(
          'INSERT INTO schema_migrations (version, checksum, applied_at, duration_ms) VALUES ($1, $2, NOW(), $3)',
          [m.version, m.checksum, Date.now() - start]
        );
        await client.query('COMMIT');
        console.log(`   ✅ Applied in ${Date.now() - start}ms`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`   ❌ Migration failed: ${m.version}`);
        console.error(`   ${err.message}`);
        process.exit(1);
      }
    }

    console.log(`\n✅ ${pending.length} migration(s) applied successfully.`);
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
    await client.end();
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

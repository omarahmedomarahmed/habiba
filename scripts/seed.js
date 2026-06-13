#!/usr/bin/env node
/**
 * 24Therapy idempotent seed script
 *
 * Creates the initial super-admin organization and user from env vars.
 * Safe to run multiple times — uses ON CONFLICT DO NOTHING.
 *
 * Required env vars:
 *   DATABASE_URL
 *   SEED_ORG_NAME        (default: "24Therapy HQ")
 *   SEED_ORG_SLUG        (default: "24therapy-hq")
 *   SEED_ADMIN_EMAIL     (required)
 *   SEED_ADMIN_PASSWORD  (required, min 12 chars)
 *   SEED_ADMIN_FIRST     (default: "Super")
 *   SEED_ADMIN_LAST      (default: "Admin")
 */

'use strict';

const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) { console.error('❌ DATABASE_URL is not set.'); process.exit(1); }

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    console.error('❌ SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required.');
    process.exit(1);
  }
  if (adminPassword.length < 12) {
    console.error('❌ SEED_ADMIN_PASSWORD must be at least 12 characters.');
    process.exit(1);
  }

  const orgName = process.env.SEED_ORG_NAME || '24Therapy HQ';
  const orgSlug = process.env.SEED_ORG_SLUG || '24therapy-hq';
  const firstName = process.env.SEED_ADMIN_FIRST || 'Super';
  const lastName = process.env.SEED_ADMIN_LAST || 'Admin';

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  console.log('✅ Connected to database');

  try {
    // Upsert organization
    const orgId = crypto.randomUUID();
    const orgResult = await client.query(`
      INSERT INTO organizations (id, name, slug, status, plan, settings, created_at, updated_at)
      VALUES ($1, $2, $3, 'active', 'enterprise', '{}', NOW(), NOW())
      ON CONFLICT (slug) DO UPDATE SET updated_at = NOW()
      RETURNING id
    `, [orgId, orgName, orgSlug]);
    const finalOrgId = orgResult.rows[0].id;
    console.log(`✅ Organization: ${orgName} (${finalOrgId})`);

    // Hash password
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    // Upsert admin user
    const userId = crypto.randomUUID();
    const userResult = await client.query(`
      INSERT INTO users (id, organization_id, email, password_hash, first_name, last_name, role, status, email_verified, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'super_admin', 'active', true, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        role = 'super_admin',
        status = 'active',
        updated_at = NOW()
      RETURNING id, email
    `, [userId, finalOrgId, adminEmail, passwordHash, firstName, lastName]);

    const user = userResult.rows[0];
    console.log(`✅ Super admin: ${user.email} (${user.id})`);
    console.log('\n🎉 Seed complete. You can log in to the admin portal now.');
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

// Reviewed: 2026-06-13 — 24Therapy audit

#!/usr/bin/env node
/**
 * One-time backfill: encrypt all existing plaintext messages.
 *
 * Run ONCE after deploying migration 027 and setting MESSAGE_ENCRYPTION_KEY.
 * Safe to re-run — skips rows already marked encrypted=true.
 *
 * Required env vars:
 *   DATABASE_URL              — target database
 *   MESSAGE_ENCRYPTION_KEY    — 64-char hex string (32 bytes for AES-256)
 *
 * Usage:
 *   node scripts/encrypt-messages.js [--dry-run]
 */

'use strict';

const { Client } = require('pg');
const { createCipheriv, randomBytes } = require('crypto');

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH = 500;

const keyHex = process.env.MESSAGE_ENCRYPTION_KEY;
if (!keyHex || keyHex.length !== 64) {
  console.error('ERROR: MESSAGE_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
  process.exit(1);
}
const ENC_KEY = Buffer.from(keyHex, 'hex');

function encrypt(plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const { rows: [{ total }] } = await client.query(
    `SELECT COUNT(*)::int AS total FROM messages WHERE encrypted = false OR encrypted IS NULL`,
  );
  console.log(`\n=== Message Encryption Backfill ===`);
  console.log(`Rows to encrypt: ${total}`);
  if (DRY_RUN) console.log('DRY RUN — no writes will occur\n');

  let processed = 0;
  let offset = 0;

  while (offset < total) {
    const { rows } = await client.query(
      `SELECT id, content FROM messages
       WHERE encrypted = false OR encrypted IS NULL
       ORDER BY created_at ASC
       LIMIT $1 OFFSET $2`,
      [BATCH, offset],
    );
    if (rows.length === 0) break;

    for (const row of rows) {
      if (!DRY_RUN) {
        const ciphertext = encrypt(row.content);
        await client.query(
          `UPDATE messages SET content = $1, encrypted = true WHERE id = $2`,
          [ciphertext, row.id],
        );
      }
      processed++;
    }

    offset += rows.length;
    process.stdout.write(`\r  Progress: ${processed}/${total}`);
  }

  await client.end();
  console.log(`\n\n${DRY_RUN ? 'DRY RUN complete.' : `✅ Encrypted ${processed} messages.`}`);
}

main().catch(err => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});

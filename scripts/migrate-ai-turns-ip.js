#!/usr/bin/env node
/**
 * One-time migration: add `ip` column to ai_turns and swap unique constraint.
 * Run with:  node --env-file=.env.local scripts/migrate-ai-turns-ip.js
 */

const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function run() {
    // 1. Add ip column
    await sql`ALTER TABLE ai_turns ADD COLUMN IF NOT EXISTS ip text`;
    console.log('✓ ip column added (or already existed)');

    // 2. Find and drop the old unique constraint on (user_id, turn_date)
    const constraints = await sql`
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'ai_turns'::regclass
          AND contype = 'u'
    `;
    for (const { conname } of constraints) {
        await sql`ALTER TABLE ai_turns DROP CONSTRAINT IF EXISTS ${sql(conname)}`;
        console.log(`✓ dropped constraint: ${conname}`);
    }

    // 3. Add new unique constraint on (ip, turn_date)
    await sql`
        ALTER TABLE ai_turns
        ADD CONSTRAINT ai_turns_ip_turn_date_key UNIQUE (ip, turn_date)
    `;
    console.log('✓ unique constraint on (ip, turn_date) added');

    console.log('\nMigration complete.');
}

run().catch(err => { console.error(err); process.exit(1); });

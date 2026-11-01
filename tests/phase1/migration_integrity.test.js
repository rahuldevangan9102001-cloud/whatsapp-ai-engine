import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUTONOMOUS_TABLES } from '../../autonomous/state_schema.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const migrationDir = path.join(root, 'database', 'migrations');
const migrationFiles = [
  '001_autonomous_core_tables.sql',
  '002_autonomous_payment_tables.sql',
  '003_autonomous_indexes.sql',
  '004_lead_followup_events.sql',
  '005_crm_notification_events.sql'
];

test('phase 1 migrations exist in order and are additive', () => {
  const sql = migrationFiles.map((file) => fs.readFileSync(path.join(migrationDir, file), 'utf8')).join('\n');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS/gi);
  assert.match(sql, /CREATE (?:UNIQUE )?INDEX IF NOT EXISTS/gi);
  assert.doesNotMatch(sql, /\b(?:DROP|DELETE|UPDATE|TRUNCATE)\b/i);
  assert.doesNotMatch(sql, /ALTER\s+TABLE\s+(?:users|conversation_logs|knowledge_base)/i);
  for (const table of [...AUTONOMOUS_TABLES.core, ...AUTONOMOUS_TABLES.payment]) assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
});

test('lead follow-up migration creates the idempotency table and reloads the API schema cache', () => {
  const sql = fs.readFileSync(path.join(migrationDir, '004_lead_followup_events.sql'), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS lead_followup_events/i);
  assert.match(sql, /UNIQUE\s*\(user_id,\s*idle_since,\s*followup_type\)/i);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_lead_followup_events_created_at/i);
  assert.match(sql, /NOTIFY\s+pgrst,\s*'reload schema'/i);
});

test('CRM notification migration creates the durable idempotent dispatch queue', () => {
  const sql = fs.readFileSync(path.join(migrationDir, '005_crm_notification_events.sql'), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.crm_notification_events/i);
  assert.match(sql, /event_id text PRIMARY KEY/i);
  assert.match(sql, /event_type text NOT NULL/i);
  assert.match(sql, /payload jsonb NOT NULL/i);
  assert.match(sql, /status text NOT NULL DEFAULT 'pending'/i);
  assert.match(sql, /attempts integer NOT NULL DEFAULT 0/i);
  assert.match(sql, /next_attempt_at timestamptz NOT NULL DEFAULT now\(\)/i);
  assert.match(sql, /processed_at timestamptz/i);
  assert.match(sql, /idx_crm_notification_events_pending[\s\S]*next_attempt_at,\s*created_at/i);
  assert.match(sql, /NOTIFY\s+pgrst,\s*'reload schema'/i);
});
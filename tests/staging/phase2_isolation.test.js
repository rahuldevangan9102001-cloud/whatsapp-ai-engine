import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertIsolatedStagingConfig,
  getIsolatedStagingConfig
} from '../../staging/phase2_isolated_config.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');

test('isolated staging configuration fails closed', () => {
  const config = getIsolatedStagingConfig();

  assert.equal(config.mode, 'shadow');
  assert.equal(config.dryRun, true);
  assert.equal(config.loadDotenv, false);
  assert.equal(config.importServer, false);
  assert.equal(config.supabaseEnabled, false);
  assert.equal(config.whatsappEnabled, false);
  assert.equal(config.paymentEnabled, false);
  assert.equal(config.referralEnabled, false);
  assert.equal(config.cronEnabled, false);
  assert.equal(config.taskExecutionEnabled, false);
  assert.equal(config.networkEnabled, false);
  assert.equal(config.autonomousReplyMode, 'shadow');
  assert.equal(assertIsolatedStagingConfig(config), true);
});

test('isolated runner does not import production runtime', () => {
  const runner = fs.readFileSync(
    path.join(root, 'staging', 'phase2_shadow_only_runner.js'),
    'utf8'
  );

  const importStatements = (runner.match(/import\s+\{[\s\S]*?\}\s+from\s+['"][^'"]+['"];|import\s+[^;]+;/g) || [])
    .map((statement) => statement.replace(/\s+/g, ' ').trim());

  assert.deepEqual(importStatements, [
    "import { runPhase2ShadowHarness } from './phase2_shadow_harness.js';",
    "import { assertIsolatedStagingConfig, getIsolatedStagingConfig } from './phase2_isolated_config.js';"
  ]);
  assert.doesNotMatch(importStatements.join('\n'), /server\.js|dotenv|supabase|baileys|axios|fetch\s*\(/i);
});

test('isolated configuration rejects an external-action override', () => {
  assert.throws(
    () => assertIsolatedStagingConfig({
      mode: 'shadow',
      dryRun: true,
      networkEnabled: true
    }),
    /isolated staging safety violation/
  );
});
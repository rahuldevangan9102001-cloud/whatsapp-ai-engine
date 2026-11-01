import { runPhase2ShadowHarness } from './phase2_shadow_harness.js';
import {
  assertIsolatedStagingConfig,
  getIsolatedStagingConfig
} from './phase2_isolated_config.js';

const config = getIsolatedStagingConfig();
assertIsolatedStagingConfig(config);

const result = await runPhase2ShadowHarness({
  text: 'staging verification message',
  user: {
    id: 'isolated-fixture-user',
    current_step: 1,
    payment_status: '',
    is_active: false,
    is_locked: false
  },
  recentMessages: [],
  memories: [],
  knowledgeEntries: []
});

const report = {
  environment: config.environment,
  mode: config.mode,
  dryRun: config.dryRun,
  result,
  externalActions: {
    whatsapp: false,
    supabase: false,
    payment: false,
    referral: false,
    cron: false,
    network: false,
    taskExecution: false
  }
};

console.log(JSON.stringify(report, null, 2));
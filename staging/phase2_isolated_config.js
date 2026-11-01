const ISOLATED_STAGING_CONFIG = Object.freeze({
  environment: 'isolated-phase2',
  mode: 'shadow',
  dryRun: true,

  loadDotenv: false,
  importServer: false,

  supabaseEnabled: false,
  whatsappEnabled: false,
  paymentEnabled: false,
  referralEnabled: false,
  cronEnabled: false,
  taskExecutionEnabled: false,
  networkEnabled: false,

  autonomousAiEnabled: true,
  autonomousReplyMode: 'shadow',
  knowledgeRetrieval: false,
  paymentActions: false,
  followups: false,
  taskProcessor: false,
  memoryWrites: false,
  auditLogging: false
});

export function getIsolatedStagingConfig() {
  return ISOLATED_STAGING_CONFIG;
}

export function assertIsolatedStagingConfig(config = ISOLATED_STAGING_CONFIG) {
  const forbidden = [
    ['loadDotenv', config.loadDotenv],
    ['importServer', config.importServer],
    ['supabaseEnabled', config.supabaseEnabled],
    ['whatsappEnabled', config.whatsappEnabled],
    ['paymentEnabled', config.paymentEnabled],
    ['referralEnabled', config.referralEnabled],
    ['cronEnabled', config.cronEnabled],
    ['taskExecutionEnabled', config.taskExecutionEnabled],
    ['networkEnabled', config.networkEnabled],
    ['paymentActions', config.paymentActions],
    ['followups', config.followups],
    ['taskProcessor', config.taskProcessor],
    ['memoryWrites', config.memoryWrites],
    ['auditLogging', config.auditLogging]
  ];

  const violations = forbidden
    .filter(([, enabled]) => enabled === true)
    .map(([name]) => name);

  if (config.mode !== 'shadow' || config.dryRun !== true || violations.length > 0) {
    throw new Error(`isolated staging safety violation: ${violations.join(', ') || 'invalid mode'}`);
  }

  return true;
}

export { ISOLATED_STAGING_CONFIG };
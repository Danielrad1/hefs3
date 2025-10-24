/**
 * ============================================
 * MASTER ENVIRONMENT CONFIGURATION
 * ============================================
 * 
 * FLIP THIS ONE SWITCH TO CONTROL EVERYTHING:
 * - 'local' = Use local emulator (fast iteration, no costs)
 * - 'cloud' = Use production cloud (real environment)
 */

const CURRENT_MODE = 'local'; // <-- CHANGE THIS TO 'cloud' FOR PRODUCTION

/**
 * ============================================
 * DO NOT EDIT BELOW THIS LINE
 * ============================================
 */

const ENVIRONMENTS = {
  local: {
    apiBaseUrl: 'http://10.0.0.58:5001/enqode-6b13f/us-central1/api',
    environment: 'development-local',
    description: '🔧 LOCAL EMULATOR MODE',
    requirements: [
      'Run: cd firebase && ./START_EMULATOR.sh',
      'Auth is bypassed automatically',
      'Changes appear instantly',
    ],
  },
  cloud: {
    apiBaseUrl: 'https://us-central1-enqode-6b13f.cloudfunctions.net/api',
    environment: 'production',
    description: '☁️  PRODUCTION CLOUD MODE',
    requirements: [
      'Deploy changes: cd firebase && firebase deploy --only functions:api',
      'Real authentication required',
      'API costs apply',
    ],
  },
};

const config = ENVIRONMENTS[CURRENT_MODE];

if (!config) {
  throw new Error(
    `Invalid CURRENT_MODE: "${CURRENT_MODE}". Must be "local" or "cloud"`
  );
}

// Log configuration on load
console.log('\n' + '='.repeat(60));
console.log(config.description);
console.log('='.repeat(60));
console.log(`Mode: ${CURRENT_MODE}`);
console.log(`API: ${config.apiBaseUrl}`);
console.log(`Environment: ${config.environment}`);
console.log('\nRequirements:');
config.requirements.forEach((req, i) => console.log(`  ${i + 1}. ${req}`));
console.log('='.repeat(60) + '\n');

module.exports = {
  MODE: CURRENT_MODE,
  API_BASE_URL: config.apiBaseUrl,
  ENVIRONMENT: config.environment,
  IS_LOCAL: CURRENT_MODE === 'local',
  IS_CLOUD: CURRENT_MODE === 'cloud',
};

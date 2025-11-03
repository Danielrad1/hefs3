/* eslint-disable @typescript-eslint/no-var-requires */
const appJson = require('./app.json');
const ENV = require('./ENV_CONFIG');
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Inline plugin: Add use_modular_headers! to Podfile (required for Firebase)
const withModularHeaders = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (fs.existsSync(podfilePath)) {
        let content = fs.readFileSync(podfilePath, 'utf-8');
        if (!content.includes('use_modular_headers!')) {
          content = content.replace(/use_expo_modules!/, 'use_expo_modules!\n  use_modular_headers!');
          fs.writeFileSync(podfilePath, content, 'utf-8');
        }
      }
      return config;
    },
  ]);
};

export default ({ config }) => withModularHeaders({
  ...config,
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    
    // Master environment configuration (controlled by ENV_CONFIG.js)
    apiBaseUrl: ENV.API_BASE_URL,
    environment: ENV.ENVIRONMENT,
    isLocal: ENV.IS_LOCAL,
    isCloud: ENV.IS_CLOUD,
    
    // Feature Flags
    enableAiFeatures: process.env.ENABLE_AI_FEATURES !== 'false',
    alwaysShowTutorial: process.env.ALWAYS_SHOW_TUTORIAL === 'true',
    verboseLogs: process.env.VERBOSE_LOGS === 'true',
    
    // RevenueCat Configuration
    rcPublicKey: process.env.RC_PUBLIC_API_KEY,
    enableIAP: process.env.ENABLE_IAP !== 'false',
    enableRcEntitlementFallback: process.env.ENABLE_RC_ENTITLEMENT_FALLBACK === 'true',
    
    // OAuth Configuration
    googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID || '953455180571-8jc7qunauq08q73uiehk7uou8d55a8mf.apps.googleusercontent.com',
    googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID || '953455180571-phelu268iaudi1u5cuhgp0pm3k0ftaan.apps.googleusercontent.com',
    
    // EAS
    eas: appJson.expo.extra?.eas,
  },
});

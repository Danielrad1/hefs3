/* eslint-disable @typescript-eslint/no-var-requires */
const appJson = require('./app.json');
const ENV = require('./ENV_CONFIG');

export default ({ config }) => ({
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
    enableCloudBackup: process.env.ENABLE_CLOUD_BACKUP !== 'false',
    enableAiFeatures: process.env.ENABLE_AI_FEATURES !== 'false',
    alwaysShowTutorial: process.env.ALWAYS_SHOW_TUTORIAL === 'true',
    
    // OAuth Configuration
    googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID || '953455180571-8jc7qunauq08q73uiehk7uou8d55a8mf.apps.googleusercontent.com',
    googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID || '953455180571-phelu268iaudi1u5cuhgp0pm3k0ftaan.apps.googleusercontent.com',
    
    // EAS
    eas: appJson.expo.extra?.eas,
  },
});

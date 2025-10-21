/* eslint-disable @typescript-eslint/no-var-requires */
const appJson = require('./app.json');

export default ({ config }) => ({
  ...config,
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    // API Configuration
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:5001/enqode-6b13f/us-central1/api',
    
    // Feature Flags
    enableCloudBackup: process.env.ENABLE_CLOUD_BACKUP !== 'false',
    enableAiFeatures: process.env.ENABLE_AI_FEATURES === 'true',
    alwaysShowTutorial: process.env.ALWAYS_SHOW_TUTORIAL === 'true' ? true : false, // Proper default handling
    
    // Environment
    environment: process.env.APP_ENV || 'development',
    
    // OAuth Configuration
    googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID || '953455180571-8jc7qunauq08q73uiehk7uou8d55a8mf.apps.googleusercontent.com',
    googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID || '953455180571-phelu268iaudi1u5cuhgp0pm3k0ftaan.apps.googleusercontent.com',
    
    // EAS
    eas: appJson.expo.extra?.eas,
  },
});

/* eslint-disable @typescript-eslint/no-var-requires */
const appJson = require('./app.json');

export default ({ config }) => ({
  ...config,
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    // API Configuration
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:5001/hefs-b3e45/us-central1/api',
    
    // Feature Flags
    enableCloudBackup: process.env.ENABLE_CLOUD_BACKUP !== 'false',
    enableAiFeatures: process.env.ENABLE_AI_FEATURES === 'true',
    alwaysShowTutorial: process.env.ALWAYS_SHOW_TUTORIAL === 'true' ? true : false, // Proper default handling
    
    // Environment
    environment: process.env.APP_ENV || 'development',
    
    // OAuth Configuration
    googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID || '126807472781-bugadft7umol0cjf1irfebrb990e5hvg.apps.googleusercontent.com',
    googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID || '126807472781-fhp7dlk7ioe0oq1h9g27fn1om0nsgig2.apps.googleusercontent.com',
    
    // EAS
    eas: appJson.expo.extra?.eas,
  },
});

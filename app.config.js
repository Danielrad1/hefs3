/* eslint-disable @typescript-eslint/no-var-requires */
const appJson = require('./app.json');

export default ({ config }) => ({
  ...config,
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    // API Configuration
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:5001/your-project/us-central1/api',
    
    // Feature Flags
    enableCloudBackup: process.env.ENABLE_CLOUD_BACKUP !== 'false',
    enableAiFeatures: process.env.ENABLE_AI_FEATURES === 'true',
    
    // Environment
    environment: process.env.APP_ENV || 'development',
    
    // EAS
    eas: appJson.expo.extra?.eas,
  },
});

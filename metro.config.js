const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add .apkg files as assets
config.resolver.assetExts.push('apkg');

module.exports = config;

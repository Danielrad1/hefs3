export const config = {
  cors: {
    // Allow Expo dev client and production domains
    origins: [
      'http://localhost:8081',
      'http://localhost:19000',
      'http://localhost:19006',
      /^exp:\/\/.*/, // Expo dev URLs
      process.env.CUSTOM_DOMAIN,
    ].filter(Boolean),
  },
};

export const errorCodes = {
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  INVALID_INPUT: 'invalid_input',
  INTERNAL_ERROR: 'internal_error',
} as const;

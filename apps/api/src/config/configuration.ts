export const configuration = () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? process.env.API_PORT ?? '3001', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',

  database: {
    url: process.env.DATABASE_URL,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? (
      process.env.NODE_ENV === 'production'
        ? (() => { throw new Error('JWT_ACCESS_SECRET env var is required in production'); })()
        : 'dev-only-access-secret-change-me'
    ),
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? (
      process.env.NODE_ENV === 'production'
        ? (() => { throw new Error('JWT_REFRESH_SECRET env var is required in production'); })()
        : 'dev-only-refresh-secret-change-me'
    ),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },

  encryption: {
    // Must be exactly 32 ASCII characters for AES-256-GCM
    key: process.env.ENCRYPTION_KEY ?? (
      process.env.NODE_ENV === 'production'
        ? (() => { throw new Error('ENCRYPTION_KEY env var is required in production'); })()
        : 'dev-only-32char-key-change-me!!!'
    ),
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
  },

  marketData: {
    yahooEnabled: process.env.YAHOO_FINANCE_ENABLED === 'true',
    alphaVantageKey: process.env.ALPHA_VANTAGE_API_KEY ?? '',
    alphaVantageEnabled: process.env.ALPHA_VANTAGE_ENABLED === 'true',
    twelveDataKey: process.env.TWELVE_DATA_API_KEY ?? '',
    twelveDataEnabled: process.env.TWELVE_DATA_ENABLED === 'true',
    coingeckoKey: process.env.COINGECKO_API_KEY ?? '',
    coingeckoEnabled: process.env.COINGECKO_ENABLED !== 'false',
    cacheTtlSeconds: parseInt(process.env.MARKET_DATA_CACHE_TTL_SECONDS ?? '300', 10),
  },

  news: {
    cryptoCompareKey: process.env.NEWS_CRYPTOCOMPARE_API_KEY ?? '',
  },

  auth: {
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3001/api/v1/auth/google/callback',
  },

  smtp: {
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? 'noreply@investment-tracker.app',
  },

  logLevel: process.env.LOG_LEVEL ?? 'debug',
});

export type AppConfig = ReturnType<typeof configuration>;

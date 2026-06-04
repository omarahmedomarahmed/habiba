export default () => ({
  // Server
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiVersion: process.env.API_VERSION || 'v1',

  // Database
  database: {
    url: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true',
    maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '10', 10),
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    ttl: parseInt(process.env.REDIS_TTL || '86400', 10),
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '30d',
  },

  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o',
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    whisperModel: process.env.OPENAI_WHISPER_MODEL || 'whisper-1',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4096', 10),
  },

  // Anthropic (fallback)
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    defaultModel: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-3-5-sonnet-20241022',
  },

  // Stripe
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },

  // Email (SMTP)
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.EMAIL_FROM || 'noreply@24therapy.ai',
    fromName: process.env.EMAIL_FROM_NAME || '24Therapy.ai',
  },

  // AWS S3
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1',
    bucket: process.env.AWS_S3_BUCKET || '24therapy-files',
    cloudfrontUrl: process.env.CLOUDFRONT_URL,
  },

  // Video (Daily.co)
  video: {
    dailyApiKey: process.env.DAILY_API_KEY,
    dailyDomain: process.env.DAILY_DOMAIN,
  },

  // App URLs
  urls: {
    frontend: process.env.FRONTEND_URL || 'http://localhost:3000',
    therapistPortal: process.env.THERAPIST_URL || 'http://localhost:3001',
    patientPortal: process.env.PATIENT_URL || 'http://localhost:3002',
    adminPortal: process.env.ADMIN_URL || 'http://localhost:3003',
    api: process.env.API_URL || 'http://localhost:4000',
  },

  // Security
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || [],
    cookieSecret: process.env.COOKIE_SECRET || 'change-me-in-production',
  },

  // Feature flags
  features: {
    aiScribeEnabled: process.env.FEATURE_AI_SCRIBE !== 'false',
    copilotEnabled: process.env.FEATURE_COPILOT !== 'false',
    radarEnabled: process.env.FEATURE_RADAR !== 'false',
    marketplaceEnabled: process.env.FEATURE_MARKETPLACE !== 'false',
    billingEnabled: process.env.FEATURE_BILLING !== 'false',
  },
});

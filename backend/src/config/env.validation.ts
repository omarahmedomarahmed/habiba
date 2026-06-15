const KNOWN_WEAK_SECRETS = new Set([
  'change-me-in-production',
  'fallback-secret',
  'secret',
  'jwt-secret',
  'cookie-secret',
  'your-secret-here',
  '',
]);

function assertSecret(value: string | undefined, name: string, isProd: boolean) {
  if (!value || KNOWN_WEAK_SECRETS.has(value)) {
    if (isProd) throw new Error(`${name} is missing or uses a known-default value. Set a strong random secret (openssl rand -hex 32).`);
    return;
  }
  if (isProd && value.length < 32) {
    throw new Error(`${name} must be at least 32 characters in production (got ${value.length}).`);
  }
}

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const isProd = config['NODE_ENV'] === 'production';

  if (isProd) {
    const missing: string[] = [];
    if (!config['DATABASE_URL']) missing.push('DATABASE_URL');
    if (!config['OPENAI_API_KEY']) missing.push('OPENAI_API_KEY');
    if (!config['CORS_ORIGINS']) missing.push('CORS_ORIGINS');

    // Security-critical: message encryption and Stripe webhook must be set in production
    if (!config['MESSAGE_ENCRYPTION_KEY']) missing.push('MESSAGE_ENCRYPTION_KEY (required — patient messages will be stored in plaintext without this)');
    if (!config['STRIPE_WEBHOOK_SECRET']) missing.push('STRIPE_WEBHOOK_SECRET (required — Stripe webhooks cannot be verified without this)');

    if (missing.length > 0) {
      throw new Error(
        `\n\n❌ 24Therapy API — missing required production env vars:\n${missing.map(v => `  • ${v}`).join('\n')}\n\nSet these in Railway → Variables.\n`,
      );
    }
    assertSecret(config['JWT_SECRET'] as string, 'JWT_SECRET', isProd);
    assertSecret(config['COOKIE_SECRET'] as string, 'COOKIE_SECRET', isProd);

    // Warn (don't block) about recommended vars missing
    const warnings: string[] = [];
    if (!config['RESEND_API_KEY']) warnings.push('RESEND_API_KEY not set — emails will log to console instead of sending');
    if (!config['DAILY_API_KEY']) warnings.push('DAILY_API_KEY not set — video sessions will not create rooms');
    if (!config['SENTRY_DSN']) warnings.push('SENTRY_DSN not set — errors will not be tracked');
    if (warnings.length > 0) {
      console.warn(`\n⚠️  24Therapy API — recommended env vars not set:\n${warnings.map(v => `  • ${v}`).join('\n')}\n`);
    }
  }

  return config;
}

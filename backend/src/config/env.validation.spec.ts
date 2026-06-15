import { validateEnv } from './env.validation';

const PROD = { NODE_ENV: 'production' };
const STRONG = 'a'.repeat(40);

describe('validateEnv', () => {
  describe('development', () => {
    it('passes with no vars set', () => {
      expect(() => validateEnv({ NODE_ENV: 'development' })).not.toThrow();
    });

    it('passes even with missing DATABASE_URL', () => {
      expect(() => validateEnv({ NODE_ENV: 'development' })).not.toThrow();
    });

    it('returns the config unchanged', () => {
      const cfg = { NODE_ENV: 'development', FOO: 'bar' };
      expect(validateEnv(cfg)).toBe(cfg);
    });
  });

  describe('production — missing required vars', () => {
    it('throws when DATABASE_URL is absent', () => {
      expect(() =>
        validateEnv({
          ...PROD,
          OPENAI_API_KEY: 'x',
          CORS_ORIGINS: 'https://app.example.com',
          JWT_SECRET: STRONG,
          COOKIE_SECRET: STRONG,
        }),
      ).toThrow(/DATABASE_URL/);
    });

    it('throws when OPENAI_API_KEY is absent', () => {
      expect(() =>
        validateEnv({
          ...PROD,
          DATABASE_URL: 'postgres://x',
          CORS_ORIGINS: 'https://app.example.com',
          JWT_SECRET: STRONG,
          COOKIE_SECRET: STRONG,
        }),
      ).toThrow(/OPENAI_API_KEY/);
    });

    it('throws when CORS_ORIGINS is absent', () => {
      expect(() =>
        validateEnv({
          ...PROD,
          DATABASE_URL: 'postgres://x',
          OPENAI_API_KEY: 'sk-x',
          JWT_SECRET: STRONG,
          COOKIE_SECRET: STRONG,
        }),
      ).toThrow(/CORS_ORIGINS/);
    });
  });

  describe('production — weak secrets', () => {
    const validBase = {
      ...PROD,
      DATABASE_URL: 'postgres://x',
      OPENAI_API_KEY: 'sk-x',
      CORS_ORIGINS: 'https://app.example.com',
      MESSAGE_ENCRYPTION_KEY: 'a'.repeat(32),
      STRIPE_WEBHOOK_SECRET: 'whsec_test',
    };

    it('rejects known-default JWT_SECRET', () => {
      expect(() =>
        validateEnv({ ...validBase, JWT_SECRET: 'change-me-in-production', COOKIE_SECRET: STRONG }),
      ).toThrow(/JWT_SECRET/);
    });

    it('rejects short JWT_SECRET (< 32 chars)', () => {
      expect(() =>
        validateEnv({ ...validBase, JWT_SECRET: 'short', COOKIE_SECRET: STRONG }),
      ).toThrow(/JWT_SECRET/);
    });

    it('rejects known-default COOKIE_SECRET', () => {
      expect(() =>
        validateEnv({ ...validBase, JWT_SECRET: STRONG, COOKIE_SECRET: 'secret' }),
      ).toThrow(/COOKIE_SECRET/);
    });

    it('rejects empty JWT_SECRET', () => {
      expect(() =>
        validateEnv({ ...validBase, JWT_SECRET: '', COOKIE_SECRET: STRONG }),
      ).toThrow(/JWT_SECRET/);
    });
  });

  describe('production — all vars valid', () => {
    it('passes and returns config when everything is set correctly', () => {
      const cfg = {
        ...PROD,
        DATABASE_URL: 'postgres://host/db',
        OPENAI_API_KEY: 'sk-test',
        CORS_ORIGINS: 'https://app.24therapy.ai',
        JWT_SECRET: STRONG,
        COOKIE_SECRET: STRONG,
        MESSAGE_ENCRYPTION_KEY: 'a'.repeat(32),
        STRIPE_WEBHOOK_SECRET: 'whsec_test',
      };
      expect(() => validateEnv(cfg)).not.toThrow();
      expect(validateEnv(cfg)).toBe(cfg);
    });
  });
});

// Reviewed: 2026-06-13 — 24Therapy audit

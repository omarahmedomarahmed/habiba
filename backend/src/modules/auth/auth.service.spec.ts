import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { DatabaseService } from '../../database/database.service';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcryptjs';

// ─── mocks ──────────────────────────────────────────────────────────────────

const HASHED_PW = bcrypt.hashSync('correctpassword', 4); // low rounds for speed

const BASE_USER = {
  id: 'user-1',
  organization_id: 'org-1',
  email: 'test@example.com',
  password_hash: HASHED_PW,
  first_name: 'Test',
  last_name: 'User',
  role: 'therapist',
  status: 'active',
  locked_until: null,
  failed_login_count: 0,
  org_name: 'Test Org',
  org_slug: 'test-org',
  org_status: 'active',
};

function makeDb(overrides: Partial<DatabaseService> = {}): jest.Mocked<DatabaseService> {
  return {
    queryOne: jest.fn().mockResolvedValue(BASE_USER),
    execute: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue([]),
    transaction: jest.fn().mockImplementation(async (fn: any) => fn({ query: jest.fn().mockResolvedValue({ rows: [BASE_USER] }) })),
    ...overrides,
  } as unknown as jest.Mocked<DatabaseService>;
}

function makeJwt(): jest.Mocked<JwtService> {
  return { sign: jest.fn().mockReturnValue('access-token') } as unknown as jest.Mocked<JwtService>;
}

function makeConfig(): jest.Mocked<ConfigService> {
  return { get: jest.fn().mockReturnValue(undefined) } as unknown as jest.Mocked<ConfigService>;
}

function makeMail(): jest.Mocked<MailService> {
  return {
    sendWelcome: jest.fn().mockResolvedValue(undefined),
    sendPasswordReset: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<MailService>;
}

async function buildService(db: jest.Mocked<DatabaseService>): Promise<AuthService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: DatabaseService, useValue: db },
      { provide: JwtService, useValue: makeJwt() },
      { provide: ConfigService, useValue: makeConfig() },
      { provide: MailService, useValue: makeMail() },
    ],
  }).compile();
  return module.get(AuthService);
}

// ─── tests ──────────────────────────────────────────────────────────────────

describe('AuthService — login', () => {
  it('returns user + tokens on valid credentials', async () => {
    const db = makeDb({
      queryOne: jest.fn().mockResolvedValue(BASE_USER),
      execute: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([{ rows: [{ id: 'rt-1' }] }]),
    });
    // generateTokens calls db.execute to store refresh token
    const service = await buildService(db);
    const result = await service.login({ email: 'test@example.com', password: 'correctpassword' });
    expect(result.user.email).toBe('test@example.com');
    expect(result.tokens).toBeDefined();
    expect(result.tokens.access_token).toBeDefined();
  });

  it('throws UnauthorizedException for unknown email', async () => {
    const db = makeDb({ queryOne: jest.fn().mockResolvedValue(null) });
    const service = await buildService(db);
    await expect(
      service.login({ email: 'nobody@example.com', password: 'x' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for wrong password', async () => {
    const service = await buildService(makeDb());
    await expect(
      service.login({ email: 'test@example.com', password: 'wrongpassword' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for suspended account', async () => {
    const db = makeDb({
      queryOne: jest.fn().mockResolvedValue({ ...BASE_USER, status: 'suspended' }),
    });
    const service = await buildService(db);
    await expect(
      service.login({ email: 'test@example.com', password: 'correctpassword' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when account is locked', async () => {
    const lockedUntil = new Date(Date.now() + 60_000);
    const db = makeDb({
      queryOne: jest.fn().mockResolvedValue({ ...BASE_USER, locked_until: lockedUntil }),
    });
    const service = await buildService(db);
    await expect(
      service.login({ email: 'test@example.com', password: 'correctpassword' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('does NOT include password_hash in response', async () => {
    const service = await buildService(makeDb());
    const result = await service.login({ email: 'test@example.com', password: 'correctpassword' });
    expect(result.user).not.toHaveProperty('password_hash');
    expect(result.user).not.toHaveProperty('mfa_secret');
  });
});

describe('AuthService — getUserIdentity', () => {
  it('returns null when user not found', async () => {
    const db = makeDb({ queryOne: jest.fn().mockResolvedValue(null) });
    const service = await buildService(db);
    const result = await service.getUserIdentity('nonexistent', 'org-1');
    expect(result).toBeNull();
  });

  it('strips sensitive fields from identity', async () => {
    const db = makeDb({
      queryOne: jest.fn().mockResolvedValue({
        ...BASE_USER,
        password_hash: 'should-not-appear',
        mfa_secret: 'should-not-appear',
        therapist_profile_id: null,
        therapist_user_id: null,
        patient_profile_id: null,
        patient_user_id: null,
      }),
    });
    const service = await buildService(db);
    const result = await service.getUserIdentity('user-1', 'org-1');
    expect(result).not.toHaveProperty('password_hash');
    expect(result).not.toHaveProperty('mfa_secret');
  });

  it('exposes userId and organizationId aliases', async () => {
    const db = makeDb({
      queryOne: jest.fn().mockResolvedValue({
        ...BASE_USER,
        therapist_profile_id: 'th-1',
        therapist_user_id: 'user-1',
        patient_profile_id: null,
        patient_user_id: null,
      }),
    });
    const service = await buildService(db);
    const result = await service.getUserIdentity('user-1', 'org-1');
    expect(result.userId).toBe('user-1');
    expect(result.organizationId).toBe('org-1');
    expect(result.therapistId).toBe('th-1');
    expect(result.patientId).toBeNull();
  });
});

describe('AuthService — logout', () => {
  it('revokes all active refresh tokens for user', async () => {
    const db = makeDb();
    const service = await buildService(db);
    await service.logout('user-1');
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE refresh_tokens'),
      ['user-1'],
    );
  });
});

// Reviewed: 2026-06-13 — 24Therapy audit

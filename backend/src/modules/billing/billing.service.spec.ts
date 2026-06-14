import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { DatabaseService } from '../../database/database.service';
import { MailService } from '../mail/mail.service';

function makeDb(overrides: Partial<DatabaseService> = {}): jest.Mocked<DatabaseService> {
  return {
    queryOne: jest.fn().mockResolvedValue(null),
    execute: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue([]),
    generateId: jest.fn().mockReturnValue('generated-id'),
    transaction: jest.fn().mockImplementation(async (fn: any) => fn({ query: jest.fn().mockResolvedValue([]) })),
    ...overrides,
  } as unknown as jest.Mocked<DatabaseService>;
}

function makeConfig(overrides: Record<string, any> = {}): jest.Mocked<ConfigService> {
  return {
    get: jest.fn((key: string) => {
      const map: Record<string, any> = {
        'stripe.secretKey': 'sk_test_placeholder',
        ...overrides,
      };
      return map[key] ?? null;
    }),
  } as unknown as jest.Mocked<ConfigService>;
}

function makeMail(): jest.Mocked<MailService> {
  return {
    sendEmail: jest.fn().mockResolvedValue(undefined),
    sendQuotaWarning: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<MailService>;
}

async function buildService(
  db: jest.Mocked<DatabaseService>,
  config?: jest.Mocked<ConfigService>,
): Promise<BillingService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      BillingService,
      { provide: DatabaseService, useValue: db },
      { provide: ConfigService, useValue: config ?? makeConfig() },
      { provide: MailService, useValue: makeMail() },
    ],
  }).compile();
  return module.get(BillingService);
}

const THERAPIST = 'th-1';
const ORG = 'org-1';

// ─── getPendingBillForTherapist ───────────────────────────────────────────────

describe('BillingService — getPendingBillForTherapist', () => {
  it('returns pending bill row when one exists', async () => {
    const bill = { id: 'charge-1', amount_due_usd: 6, stripe_checkout_url: null };
    const db = makeDb({ queryOne: jest.fn().mockResolvedValue(bill) });
    const svc = await buildService(db);
    const result = await svc.getPendingBillForTherapist(THERAPIST);
    expect(result).toEqual(bill);
  });

  it('returns null when no pending bills', async () => {
    const db = makeDb({ queryOne: jest.fn().mockResolvedValue(null) });
    const svc = await buildService(db);
    const result = await svc.getPendingBillForTherapist(THERAPIST);
    expect(result).toBeNull();
  });
});

// ─── checkSessionCreationAllowed ──────────────────────────────────────────────

describe('BillingService — checkSessionCreationAllowed', () => {
  it('allows creation when no pending bills for pay_per_session', async () => {
    const db = makeDb({
      queryOne: jest.fn()
        .mockResolvedValueOnce({ current_plan_key: 'pay_per_session' })
        .mockResolvedValueOnce(null),
    });
    const svc = await buildService(db);
    await expect(svc.checkSessionCreationAllowed(THERAPIST)).resolves.toBeUndefined();
  });

  it('throws when pay_per_session therapist has unpaid bill', async () => {
    const db = makeDb({
      queryOne: jest.fn()
        .mockResolvedValueOnce({ current_plan_key: 'pay_per_session' })
        .mockResolvedValueOnce({ id: 'charge-1', amount_due_usd: 6, stripe_checkout_url: null }),
    });
    const svc = await buildService(db);
    await expect(svc.checkSessionCreationAllowed(THERAPIST)).rejects.toThrow('PAYMENT_REQUIRED');
  });

  it('allows creation for starter plan therapist regardless of bills', async () => {
    const db = makeDb({
      queryOne: jest.fn().mockResolvedValue({ current_plan_key: 'starter' }),
    });
    const svc = await buildService(db);
    await expect(svc.checkSessionCreationAllowed(THERAPIST)).resolves.toBeUndefined();
  });
});

// ─── getTherapistUsageSummary ─────────────────────────────────────────────────

describe('BillingService — getTherapistUsageSummary', () => {
  it('throws NotFoundException when therapist not found', async () => {
    const db = makeDb({ queryOne: jest.fn().mockResolvedValue(null) });
    const svc = await buildService(db);
    await expect(svc.getTherapistUsageSummary(THERAPIST)).rejects.toThrow(NotFoundException);
  });

  it('returns usage summary with plan details for pay_per_session therapist', async () => {
    const db = makeDb({
      queryOne: jest.fn()
        .mockResolvedValueOnce({ current_plan_key: 'pay_per_session', trial_session_used: true })
        .mockResolvedValueOnce({ name: 'Pay As You Go', monthly_price_usd: 0, price_per_session_usd: 6 })
        .mockResolvedValueOnce({ sessions_this_month: '3' })
        .mockResolvedValueOnce(null), // ai_assistant_credits
      query: jest.fn().mockResolvedValue([]),
    });
    const svc = await buildService(db);
    const result = await svc.getTherapistUsageSummary(THERAPIST);
    expect(result.plan.plan_key).toBe('pay_per_session');
    expect(result.sessions_this_month).toBe(3);
    expect(result.trial_session_used).toBe(true);
    expect(result.quota).toBeNull();
  });
});

// ─── getPlans ────────────────────────────────────────────────────────────────

describe('BillingService — getPlans', () => {
  it('queries active plans from db', async () => {
    const plan = { id: 'plan-1', plan_key: 'starter', name: 'Starter', is_active: true };
    const db = makeDb({ query: jest.fn().mockResolvedValue([plan]) });
    const svc = await buildService(db);
    const result = await svc.getPlans();
    expect(result).toHaveLength(1);
    expect(result[0].plan_key).toBe('starter');
  });
});

// ─── onSessionCompleted — PAYG plan ──────────────────────────────────────────

describe('BillingService — onSessionCompleted', () => {
  it('does not throw on billing failure (never blocks session completion)', async () => {
    const db = makeDb({
      queryOne: jest.fn().mockRejectedValue(new Error('DB down')),
    });
    const svc = await buildService(db);
    await expect(
      svc.onSessionCompleted({ id: 'sess-1', therapist_id: THERAPIST, organization_id: ORG }),
    ).resolves.toBeUndefined();
  });
});

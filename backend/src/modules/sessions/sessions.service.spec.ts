import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SessionsService } from './sessions.service';
import { DatabaseService } from '../../database/database.service';
import { ConfigService } from '@nestjs/config';
import { AIService } from '../ai/ai.service';
import { BillingService } from '../billing/billing.service';
import { CrisisService } from '../crisis/crisis.service';
import { MailService } from '../mail/mail.service';

function makeDb(overrides: Partial<DatabaseService> = {}): jest.Mocked<DatabaseService> {
  return {
    queryOne: jest.fn().mockResolvedValue(null),
    execute: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as jest.Mocked<DatabaseService>;
}

function makeConfig(): jest.Mocked<ConfigService> {
  return {
    get: jest.fn().mockReturnValue(null),
  } as unknown as jest.Mocked<ConfigService>;
}

function makeBilling(): jest.Mocked<BillingService> {
  return {
    getPendingBillForTherapist: jest.fn().mockResolvedValue(null),
    onSessionCompleted: jest.fn().mockResolvedValue(undefined),
    checkSessionCreationAllowed: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<BillingService>;
}

function makeAI(): jest.Mocked<AIService> {
  return {} as unknown as jest.Mocked<AIService>;
}

function makeCrisis(): jest.Mocked<CrisisService> {
  return {} as unknown as jest.Mocked<CrisisService>;
}

function makeEventEmitter(): jest.Mocked<EventEmitter2> {
  return { emit: jest.fn(), emitAsync: jest.fn() } as unknown as jest.Mocked<EventEmitter2>;
}

function makeMail(): jest.Mocked<MailService> {
  return { sendSessionInvite: jest.fn(), sendSessionReport: jest.fn() } as unknown as jest.Mocked<MailService>;
}

async function buildService(
  db: jest.Mocked<DatabaseService>,
  billing?: jest.Mocked<BillingService>,
): Promise<SessionsService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      SessionsService,
      { provide: DatabaseService, useValue: db },
      { provide: ConfigService, useValue: makeConfig() },
      { provide: EventEmitter2, useValue: makeEventEmitter() },
      { provide: AIService, useValue: makeAI() },
      { provide: CrisisService, useValue: makeCrisis() },
      { provide: BillingService, useValue: billing ?? makeBilling() },
      { provide: MailService, useValue: makeMail() },
    ],
  }).compile();
  return module.get(SessionsService);
}

const ORG = 'org-1';
const THERAPIST = 'th-1';
const PATIENT = 'pt-1';

const SESSION = {
  id: 'sess-1',
  organization_id: ORG,
  therapist_id: THERAPIST,
  patient_id: PATIENT,
  status: 'scheduled',
  session_number: 1,
  created_at: new Date().toISOString(),
};

// ─── findAll ─────────────────────────────────────────────────────────────────

describe('SessionsService — findAll', () => {
  it('returns sessions from db', async () => {
    const db = makeDb({ query: jest.fn().mockResolvedValue([SESSION]) });
    const svc = await buildService(db);
    const result = await svc.findAll(ORG);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('sess-1');
  });

  it('propagates db errors', async () => {
    const db = makeDb({ query: jest.fn().mockRejectedValue(new Error('fail')) });
    const svc = await buildService(db);
    await expect(svc.findAll(ORG)).rejects.toThrow('fail');
  });
});

// ─── findOne ─────────────────────────────────────────────────────────────────

describe('SessionsService — findOne', () => {
  it('returns session when found', async () => {
    const db = makeDb({ queryOne: jest.fn().mockResolvedValue(SESSION) });
    const svc = await buildService(db);
    const result = await svc.findOne('sess-1', ORG);
    expect(result.id).toBe('sess-1');
  });

  it('throws NotFoundException when session missing', async () => {
    const db = makeDb({ queryOne: jest.fn().mockResolvedValue(null) });
    const svc = await buildService(db);
    await expect(svc.findOne('missing', ORG)).rejects.toThrow(NotFoundException);
  });
});

// ─── getTherapistUsage ────────────────────────────────────────────────────────

describe('SessionsService — getTherapistUsage', () => {
  it('returns usage with defaults when no row found', async () => {
    const db = makeDb({ queryOne: jest.fn().mockResolvedValue(null) });
    const svc = await buildService(db);
    const usage = await svc.getTherapistUsage(THERAPIST);
    expect(usage.plan_key).toBe('free_trial');
    expect(usage.sessions_this_month).toBe(0);
    expect(usage.trial_session_used).toBe(false);
  });

  it('returns real usage from db', async () => {
    const db = makeDb({
      queryOne: jest.fn().mockResolvedValue({
        current_plan_key: 'pay_per_session',
        trial_session_used: true,
        sessions_this_month: '3',
        max_sessions_month: null,
      }),
    });
    const svc = await buildService(db);
    const usage = await svc.getTherapistUsage(THERAPIST);
    expect(usage.plan_key).toBe('pay_per_session');
    expect(usage.sessions_this_month).toBe(3);
    expect(usage.trial_session_used).toBe(true);
  });
});

// ─── create with billing gate ─────────────────────────────────────────────────

describe('SessionsService — create billing gate', () => {
  it('blocks creation when pay_per_session therapist has unpaid bill', async () => {
    const db = makeDb({
      queryOne: jest.fn().mockResolvedValue({
        current_plan_key: 'pay_per_session',
        trial_session_used: true,
        sessions_this_month: '1',
        max_sessions_month: null,
      }),
    });
    const billing = makeBilling();
    billing.getPendingBillForTherapist.mockResolvedValue({
      id: 'charge-1',
      amount_due_usd: 6,
      stripe_checkout_url: 'https://stripe.com/pay',
    } as any);
    const svc = await buildService(db, billing);
    await expect(
      svc.create(ORG, { therapist_id: THERAPIST, patient_id: PATIENT, session_type: 'individual' }),
    ).rejects.toThrow();
  });

  it('blocks free_trial therapist when trial already used', async () => {
    const db = makeDb({
      queryOne: jest.fn().mockResolvedValue({
        current_plan_key: 'free_trial',
        trial_session_used: true,
        sessions_this_month: '1',
        max_sessions_month: null,
      }),
    });
    const svc = await buildService(db);
    await expect(
      svc.create(ORG, { therapist_id: THERAPIST, patient_id: PATIENT }),
    ).rejects.toThrow();
  });
});

// ─── updateStatus ─────────────────────────────────────────────────────────────

describe('SessionsService — updateStatus', () => {
  it('throws NotFoundException when session not found', async () => {
    const db = makeDb({ queryOne: jest.fn().mockResolvedValue(null) });
    const svc = await buildService(db);
    await expect(svc.updateStatus('missing', ORG, 'completed')).rejects.toThrow(NotFoundException);
  });
});

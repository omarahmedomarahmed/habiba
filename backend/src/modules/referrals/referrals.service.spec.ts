import { Test, TestingModule } from '@nestjs/testing';
import { ReferralsService } from './referrals.service';
import { DatabaseService } from '../../database/database.service';

function makeDb(overrides: Partial<DatabaseService> = {}): jest.Mocked<DatabaseService> {
  return {
    queryOne: jest.fn().mockResolvedValue(null),
    execute: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as jest.Mocked<DatabaseService>;
}

async function buildService(db: jest.Mocked<DatabaseService>): Promise<ReferralsService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ReferralsService,
      { provide: DatabaseService, useValue: db },
    ],
  }).compile();
  return module.get(ReferralsService);
}

const ORG = 'org-1';
const THERAPIST = 'th-1';

// ─── list ────────────────────────────────────────────────────────────────────

describe('ReferralsService — list', () => {
  it('returns referrals from db', async () => {
    const row = { id: 'ref-1', patient_id: 'pt-1', status: 'draft', patient_name: 'Jane Doe' };
    const db = makeDb({ query: jest.fn().mockResolvedValue([row]) });
    const svc = await buildService(db);
    const result = await svc.list(ORG);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ref-1');
  });

  it('returns empty array on db error', async () => {
    const db = makeDb({ query: jest.fn().mockRejectedValue(new Error('fail')) });
    const svc = await buildService(db);
    const result = await svc.list(ORG);
    expect(result).toEqual([]);
  });

  it('applies status filter', async () => {
    const db = makeDb({ query: jest.fn().mockResolvedValue([]) });
    const svc = await buildService(db);
    await svc.list(ORG, { status: 'sent' });
    const sql: string = (db.query as jest.Mock).mock.calls[0][0];
    expect(sql).toContain('r.status');
  });
});

// ─── create ──────────────────────────────────────────────────────────────────

describe('ReferralsService — create', () => {
  it('inserts referral and returns id', async () => {
    const db = makeDb({ query: jest.fn().mockResolvedValue([]) });
    const svc = await buildService(db);
    const result = await svc.create(ORG, THERAPIST, {
      patient_id: 'pt-1',
      referred_to_name: 'Dr. Smith',
      specialty: 'Psychiatry',
    });
    expect(result.id).toBeDefined();
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO referrals'),
      expect.any(Array),
    );
  });

  it('defaults status to draft', async () => {
    const db = makeDb({ query: jest.fn().mockResolvedValue([]) });
    const svc = await buildService(db);
    await svc.create(ORG, THERAPIST, { patient_id: 'pt-1', referred_to_name: 'Dr. Smith' });
    const params: any[] = (db.query as jest.Mock).mock.calls[0][1];
    expect(params).toContain('draft');
  });

  it('defaults urgency to routine when not provided', async () => {
    const db = makeDb({ query: jest.fn().mockResolvedValue([]) });
    const svc = await buildService(db);
    await svc.create(ORG, THERAPIST, { patient_id: 'pt-1', referred_to_name: 'Dr. Smith' });
    const params: any[] = (db.query as jest.Mock).mock.calls[0][1];
    expect(params).toContain('routine');
  });
});

// ─── update ──────────────────────────────────────────────────────────────────

describe('ReferralsService — update', () => {
  it('updates status field', async () => {
    const db = makeDb({ query: jest.fn().mockResolvedValue([]) });
    const svc = await buildService(db);
    await svc.update('ref-1', ORG, { status: 'accepted' });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE referrals'),
      expect.any(Array),
    );
  });

  it('no-ops when dto is empty', async () => {
    const db = makeDb();
    const svc = await buildService(db);
    const result = await svc.update('ref-1', ORG, {});
    expect(result).toBeUndefined();
    expect(db.query).not.toHaveBeenCalled();
  });
});

// ─── send ────────────────────────────────────────────────────────────────────

describe('ReferralsService — send', () => {
  it('sets status to sent and returns success', async () => {
    const db = makeDb({ query: jest.fn().mockResolvedValue([]) });
    const svc = await buildService(db);
    const result = await svc.send('ref-1', ORG);
    expect(result).toEqual({ success: true });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'sent'"),
      expect.arrayContaining(['ref-1', ORG]),
    );
  });
});

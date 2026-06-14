import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { DatabaseService } from '../../database/database.service';

function makeDb(overrides: Partial<DatabaseService> = {}): jest.Mocked<DatabaseService> {
  return {
    queryOne: jest.fn().mockResolvedValue(null),
    execute: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as jest.Mocked<DatabaseService>;
}

async function buildService(db: jest.Mocked<DatabaseService>): Promise<ReportsService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ReportsService,
      { provide: DatabaseService, useValue: db },
    ],
  }).compile();
  return module.get(ReportsService);
}

const ORG = 'org-1';
const THERAPIST = 'th-1';

// ─── list ────────────────────────────────────────────────────────────────────

describe('ReportsService — list', () => {
  it('returns reports from db', async () => {
    const row = { id: 'rpt-1', status: 'draft', patient_name: 'Jane Doe' };
    const db = makeDb({ query: jest.fn().mockResolvedValue([row]) });
    const svc = await buildService(db);
    const result = await svc.list(ORG);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('rpt-1');
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
    await svc.list(ORG, { status: 'signed' });
    const sql: string = (db.query as jest.Mock).mock.calls[0][0];
    expect(sql).toContain('sr.status');
  });
});

// ─── generate ────────────────────────────────────────────────────────────────

describe('ReportsService — generate', () => {
  it('inserts report and returns id with draft status', async () => {
    const db = makeDb({ query: jest.fn().mockResolvedValue([]) });
    const svc = await buildService(db);
    const result = await svc.generate(ORG, THERAPIST, {
      patient_id: 'pt-1',
      report_type: 'progress',
      content: { summary: 'Patient doing well' },
    });
    expect(result.id).toBeDefined();
    expect(result.status).toBe('draft');
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO session_reports'),
      expect.any(Array),
    );
  });

  it('defaults report_type to progress', async () => {
    const db = makeDb({ query: jest.fn().mockResolvedValue([]) });
    const svc = await buildService(db);
    await svc.generate(ORG, THERAPIST, { patient_id: 'pt-1' });
    const params: any[] = (db.query as jest.Mock).mock.calls[0][1];
    expect(params).toContain('progress');
  });
});

// ─── sign ────────────────────────────────────────────────────────────────────

describe('ReportsService — sign', () => {
  it('updates status to signed and returns success', async () => {
    const db = makeDb({ query: jest.fn().mockResolvedValue([]) });
    const svc = await buildService(db);
    const result = await svc.sign('rpt-1', ORG);
    expect(result).toEqual({ success: true });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'signed'"),
      expect.arrayContaining(['rpt-1', ORG]),
    );
  });
});

// ─── send ────────────────────────────────────────────────────────────────────

describe('ReportsService — send', () => {
  it('updates status to sent and returns success', async () => {
    const db = makeDb({ query: jest.fn().mockResolvedValue([]) });
    const svc = await buildService(db);
    const result = await svc.send('rpt-1', ORG);
    expect(result).toEqual({ success: true });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'sent'"),
      expect.arrayContaining(['rpt-1', ORG]),
    );
  });
});

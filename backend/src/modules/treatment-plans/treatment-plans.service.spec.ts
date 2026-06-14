import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TreatmentPlansService } from './treatment-plans.service';
import { DatabaseService } from '../../database/database.service';

function makeDb(overrides: Partial<DatabaseService> = {}): jest.Mocked<DatabaseService> {
  return {
    queryOne: jest.fn().mockResolvedValue(null),
    execute: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as jest.Mocked<DatabaseService>;
}

async function buildService(db: jest.Mocked<DatabaseService>): Promise<TreatmentPlansService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      TreatmentPlansService,
      { provide: DatabaseService, useValue: db },
    ],
  }).compile();
  return module.get(TreatmentPlansService);
}

const ORG = 'org-1';
const THERAPIST = 'th-1';
const PLAN = {
  id: 'plan-1',
  organization_id: ORG,
  therapist_id: THERAPIST,
  patient_id: 'pt-1',
  status: 'active',
  goals: [{ id: 'g-1', description: 'Reduce anxiety', status: 'not_started', progress: 0 }],
  patient_name: 'Jane Doe',
};

// ─── list ────────────────────────────────────────────────────────────────────

describe('TreatmentPlansService — list', () => {
  it('returns rows from db with no filters', async () => {
    const db = makeDb({ query: jest.fn().mockResolvedValue([PLAN]) });
    const svc = await buildService(db);
    const result = await svc.list(ORG);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('plan-1');
  });

  it('returns empty array on db error', async () => {
    const db = makeDb({ query: jest.fn().mockRejectedValue(new Error('db error')) });
    const svc = await buildService(db);
    const result = await svc.list(ORG);
    expect(result).toEqual([]);
  });

  it('filters by patient_id', async () => {
    const db = makeDb({ query: jest.fn().mockResolvedValue([PLAN]) });
    const svc = await buildService(db);
    await svc.list(ORG, { patient_id: 'pt-1' });
    const sql: string = (db.query as jest.Mock).mock.calls[0][0];
    expect(sql).toContain('tp.patient_id');
  });
});

// ─── getOne ──────────────────────────────────────────────────────────────────

describe('TreatmentPlansService — getOne', () => {
  it('returns plan when found', async () => {
    const db = makeDb({ queryOne: jest.fn().mockResolvedValue(PLAN) });
    const svc = await buildService(db);
    const result = await svc.getOne('plan-1', ORG);
    expect(result.id).toBe('plan-1');
  });

  it('throws NotFoundException when plan not found', async () => {
    const db = makeDb({ queryOne: jest.fn().mockResolvedValue(null) });
    const svc = await buildService(db);
    await expect(svc.getOne('nonexistent', ORG)).rejects.toThrow(NotFoundException);
  });
});

// ─── create ──────────────────────────────────────────────────────────────────

describe('TreatmentPlansService — create', () => {
  it('inserts plan and returns it via getOne', async () => {
    const db = makeDb({
      query: jest.fn().mockResolvedValue([]),
      queryOne: jest.fn().mockResolvedValue(PLAN),
    });
    const svc = await buildService(db);
    const result = await svc.create(ORG, THERAPIST, {
      patient_id: 'pt-1',
      presenting_problem: 'Anxiety',
      primary_diagnosis: 'F41.1',
      goals: [],
    });
    expect(result.id).toBe('plan-1');
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO treatment_plans'),
      expect.any(Array),
    );
  });
});

// ─── update ──────────────────────────────────────────────────────────────────

describe('TreatmentPlansService — update', () => {
  it('updates status and returns updated plan', async () => {
    const updated = { ...PLAN, status: 'completed' };
    const db = makeDb({
      query: jest.fn().mockResolvedValue([]),
      queryOne: jest.fn().mockResolvedValue(updated),
    });
    const svc = await buildService(db);
    const result = await svc.update('plan-1', ORG, { status: 'completed' });
    expect(result.status).toBe('completed');
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE treatment_plans'),
      expect.any(Array),
    );
  });

  it('returns plan unchanged when dto is empty', async () => {
    const db = makeDb({ queryOne: jest.fn().mockResolvedValue(PLAN) });
    const svc = await buildService(db);
    const result = await svc.update('plan-1', ORG, {});
    expect(result.id).toBe('plan-1');
    expect(db.query).not.toHaveBeenCalled();
  });
});

// ─── addGoal ─────────────────────────────────────────────────────────────────

describe('TreatmentPlansService — addGoal', () => {
  it('appends goal to existing goals array and returns new goal', async () => {
    const db = makeDb({
      queryOne: jest.fn().mockResolvedValue(PLAN),
      query: jest.fn().mockResolvedValue([]),
    });
    const svc = await buildService(db);
    const newGoal = { description: 'Build coping skills', priority: 'high' };
    const result = await svc.addGoal('plan-1', ORG, newGoal);
    expect(result.description).toBe('Build coping skills');
    expect(result.id).toBeDefined();
    expect(result.status).toBe('not_started');
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE treatment_plans SET goals'),
      expect.any(Array),
    );
  });
});

// ─── getProtocols ─────────────────────────────────────────────────────────────

describe('TreatmentPlansService — getProtocols', () => {
  it('returns built-in protocol list', async () => {
    const db = makeDb();
    const svc = await buildService(db);
    const result = await svc.getProtocols();
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('id');
    expect(result[0]).toHaveProperty('evidence');
  });
});

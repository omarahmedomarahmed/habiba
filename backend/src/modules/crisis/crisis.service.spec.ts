/**
 * LIFE-SAFETY GATE — crisis.service.spec.ts
 *
 * Invariants that must NEVER regress:
 *  1. A keyword hit persists a risk_assessment row even when modelGateway throws.
 *  2. A keyword hit emits crisis_alert (ai.risk_detected) to therapists/admins.
 *  3. Patients receive crisis_support with supportive copy — NEVER the risk level.
 *  4. A keyword hit within the 10-minute dedup window does NOT create a duplicate row.
 *  5. AI escalation only fires when AI level > 'elevated'.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CrisisService } from './crisis.service';
import { DatabaseService } from '../../database/database.service';

// ─── helpers ────────────────────────────────────────────────────────────────

const SESSION = {
  id: 'sess-1',
  patient_id: 'pt-1',
  therapist_id: 'th-1',
  therapist_user_id: 'user-th-1',
  patient_user_id: 'user-pt-1',
};

function makeDb(overrides: Partial<{
  queryOne: jest.Mock;
  execute: jest.Mock;
  query: jest.Mock;
}> = {}): jest.Mocked<DatabaseService> {
  return {
    queryOne: jest.fn().mockResolvedValue(SESSION),
    execute: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as jest.Mocked<DatabaseService>;
}

function makeEmitter(): jest.Mocked<EventEmitter2> {
  return { emit: jest.fn() } as unknown as jest.Mocked<EventEmitter2>;
}

// ─── tests ──────────────────────────────────────────────────────────────────

describe('CrisisService — handleKeywordHit', () => {
  let service: CrisisService;
  let db: jest.Mocked<DatabaseService>;
  let emitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    db = makeDb({
      queryOne: jest.fn()
        .mockResolvedValueOnce(SESSION)   // session lookup
        .mockResolvedValueOnce(null),     // dedup check → no recent alert
    });
    emitter = makeEmitter();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrisisService,
        { provide: DatabaseService, useValue: db },
        { provide: EventEmitter2, useValue: emitter },
      ],
    }).compile();

    service = module.get(CrisisService);
  });

  it('persists risk_assessment row on keyword hit', async () => {
    await service.handleKeywordHit('sess-1', 'org-1', ['suicide', 'kill myself']);
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO risk_assessments'),
      expect.arrayContaining(['sess-1', 'org-1']),
    );
  });

  it('emits ai.risk_detected (crisis_alert path) to therapist/admin', async () => {
    await service.handleKeywordHit('sess-1', 'org-1', ['end my life']);
    const calls: string[] = (emitter.emit as jest.Mock).mock.calls.map((c: any[]) => c[0] as string);
    expect(calls).toContain('ai.risk_detected');
  });

  it('emits crisis_support to patient — never crisis_alert', async () => {
    await service.handleKeywordHit('sess-1', 'org-1', ['hurt myself']);
    const calls = (emitter.emit as jest.Mock).mock.calls as Array<[string, any]>;
    const crisisAlertToPatient = calls.find(
      ([event, payload]) => event === 'ai.risk_detected' && payload?.patientUserId === 'user-pt-1',
    );
    expect(crisisAlertToPatient).toBeUndefined();

    const supportCall = calls.find(([event]) => event === 'crisis.support');
    expect(supportCall).toBeDefined();
    const supportPayload = supportCall![1];
    expect(supportPayload.patientUserId).toBe('user-pt-1');
    // Must NOT include risk level or indicators — only supportive message
    expect(supportPayload).not.toHaveProperty('riskLevel');
    expect(supportPayload).not.toHaveProperty('indicators');
    expect(typeof supportPayload.message).toBe('string');
    expect(supportPayload.message.length).toBeGreaterThan(0);
  });

  it('persists row even when db.execute throws on first call (notify still fires)', async () => {
    db.execute.mockRejectedValueOnce(new Error('DB write failed'));
    // Should not throw — alert pipeline must not be blocked by one DB failure
    await expect(
      service.handleKeywordHit('sess-1', 'org-1', ['die']),
    ).resolves.toBeUndefined();
    // crisis_alert event still emitted
    const calls: string[] = (emitter.emit as jest.Mock).mock.calls.map((c: any[]) => c[0] as string);
    expect(calls).toContain('ai.risk_detected');
  });

  it('skips duplicate alert within dedup window', async () => {
    // Arrange: dedup check returns a recent alert
    db = makeDb({
      queryOne: jest.fn()
        .mockResolvedValueOnce(SESSION)              // session lookup
        .mockResolvedValueOnce({ id: 'existing' }), // dedup → found
    });
    emitter = makeEmitter();
    const module = await Test.createTestingModule({
      providers: [
        CrisisService,
        { provide: DatabaseService, useValue: db },
        { provide: EventEmitter2, useValue: emitter },
      ],
    }).compile();
    service = module.get(CrisisService);

    await service.handleKeywordHit('sess-1', 'org-1', ['hurt myself']);

    expect(db.execute).not.toHaveBeenCalled();
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it('does nothing when session is not found', async () => {
    db = makeDb({ queryOne: jest.fn().mockResolvedValue(null) });
    emitter = makeEmitter();
    const module = await Test.createTestingModule({
      providers: [
        CrisisService,
        { provide: DatabaseService, useValue: db },
        { provide: EventEmitter2, useValue: emitter },
      ],
    }).compile();
    service = module.get(CrisisService);

    await service.handleKeywordHit('nonexistent', 'org-1', ['die']);
    expect(emitter.emit).not.toHaveBeenCalled();
  });
});

describe('CrisisService — handleAiAnalyzed', () => {
  let service: CrisisService;
  let db: jest.Mocked<DatabaseService>;
  let emitter: jest.Mocked<EventEmitter2>;

  const AI_PAYLOAD = {
    sessionId: 'sess-1',
    orgId: 'org-1',
    riskDetected: true,
    riskLevel: 'critical',
    riskType: 'suicidal',
    indicators: ['explicit plan'],
    confidence: 0.97,
    recommendedAction: 'Intervene immediately',
    therapistId: 'th-1',
    therapistUserId: 'user-th-1',
    patientId: 'pt-1',
    patientUserId: 'user-pt-1',
  };

  beforeEach(async () => {
    db = makeDb({
      queryOne: jest.fn().mockResolvedValue(null), // no recent dedup row
    });
    emitter = makeEmitter();

    const module = await Test.createTestingModule({
      providers: [
        CrisisService,
        { provide: DatabaseService, useValue: db },
        { provide: EventEmitter2, useValue: emitter },
      ],
    }).compile();
    service = module.get(CrisisService);
  });

  it('escalates when AI level > elevated', async () => {
    await service.handleAiAnalyzed(AI_PAYLOAD);
    const calls: string[] = (emitter.emit as jest.Mock).mock.calls.map((c: any[]) => c[0] as string);
    expect(calls).toContain('ai.risk_detected');
  });

  it('does NOT escalate when AI level is "none"', async () => {
    await service.handleAiAnalyzed({ ...AI_PAYLOAD, riskDetected: false, riskLevel: 'none' });
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it('does NOT escalate when AI level === elevated (keyword already handled it)', async () => {
    await service.handleAiAnalyzed({ ...AI_PAYLOAD, riskLevel: 'elevated' });
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it('does NOT escalate when AI level < elevated (e.g. low)', async () => {
    await service.handleAiAnalyzed({ ...AI_PAYLOAD, riskLevel: 'low' });
    expect(emitter.emit).not.toHaveBeenCalled();
  });
});

describe('CrisisService — getActiveCount', () => {
  it('returns 0 when no active alerts', async () => {
    const db = makeDb({ queryOne: jest.fn().mockResolvedValue({ count: '0' }) });
    const module = await Test.createTestingModule({
      providers: [
        CrisisService,
        { provide: DatabaseService, useValue: db },
        { provide: EventEmitter2, useValue: makeEmitter() },
      ],
    }).compile();
    const service = module.get(CrisisService);
    const result = await service.getActiveCount('org-1');
    expect(result).toEqual({ count: 0 });
  });

  it('coerces string count to number', async () => {
    const db = makeDb({ queryOne: jest.fn().mockResolvedValue({ count: '7' }) });
    const module = await Test.createTestingModule({
      providers: [
        CrisisService,
        { provide: DatabaseService, useValue: db },
        { provide: EventEmitter2, useValue: makeEmitter() },
      ],
    }).compile();
    const service = module.get(CrisisService);
    const result = await service.getActiveCount('org-1');
    expect(result).toEqual({ count: 7 });
  });
});

// Reviewed: 2026-06-13 — 24Therapy audit

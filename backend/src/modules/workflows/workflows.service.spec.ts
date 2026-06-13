import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { DatabaseService } from '../../database/database.service';

function makeDb(overrides: Partial<DatabaseService> = {}): jest.Mocked<DatabaseService> {
  return {
    queryOne: jest.fn().mockResolvedValue(null),
    execute: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as jest.Mocked<DatabaseService>;
}

async function buildService(db: jest.Mocked<DatabaseService>): Promise<WorkflowsService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      WorkflowsService,
      { provide: DatabaseService, useValue: db },
    ],
  }).compile();
  return module.get(WorkflowsService);
}

const ORG = 'org-1';
const THERAPIST = 'th-1';
const PATIENT = 'pt-1';

const WORKFLOW = {
  id: 'wf-1',
  organization_id: ORG,
  therapist_id: THERAPIST,
  patient_id: PATIENT,
  workflow_type: 'patient_intake',
  status: 'pending',
  created_at: new Date().toISOString(),
};

const TASK = {
  id: 'task-1',
  workflow_id: 'wf-1',
  organization_id: ORG,
  status: 'pending',
  is_required: true,
  patient_id: PATIENT,
};

// ─── listWorkflowTemplates ────────────────────────────────────────────────────

describe('WorkflowsService — listWorkflowTemplates', () => {
  it('returns built-in templates', async () => {
    const db = makeDb();
    const svc = await buildService(db);
    const result = await svc.listWorkflowTemplates();
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('workflow_type');
    expect(result[0]).toHaveProperty('steps');
  });

  it('filters by workflow_type', async () => {
    const db = makeDb();
    const svc = await buildService(db);
    const result = await svc.listWorkflowTemplates({ workflow_type: 'session_post' });
    expect(result).toHaveLength(1);
    expect(result[0].workflow_type).toBe('session_post');
  });
});

// ─── createWorkflow ───────────────────────────────────────────────────────────

describe('WorkflowsService — createWorkflow', () => {
  it('inserts workflow and creates tasks from template', async () => {
    const db = makeDb({
      query: jest.fn()
        .mockResolvedValueOnce([WORKFLOW])
        .mockResolvedValue([]),
    });
    const svc = await buildService(db);
    const result = await svc.createWorkflow({
      organization_id: ORG,
      therapist_id: THERAPIST,
      patient_id: PATIENT,
      workflow_type: 'patient_intake',
    });
    expect(result.id).toBe('wf-1');
    // Should have inserted workflow + tasks
    expect((db.query as jest.Mock).mock.calls.length).toBeGreaterThan(1);
  });
});

// ─── getWorkflow ──────────────────────────────────────────────────────────────

describe('WorkflowsService — getWorkflow', () => {
  it('returns workflow with tasks', async () => {
    const db = makeDb({
      queryOne: jest.fn().mockResolvedValue(WORKFLOW),
      query: jest.fn().mockResolvedValue([TASK]),
    });
    const svc = await buildService(db);
    const result = await svc.getWorkflow('wf-1', ORG);
    expect(result.id).toBe('wf-1');
    expect(result.tasks).toHaveLength(1);
  });

  it('throws NotFoundException when workflow not found', async () => {
    const db = makeDb({ queryOne: jest.fn().mockResolvedValue(null) });
    const svc = await buildService(db);
    await expect(svc.getWorkflow('missing', ORG)).rejects.toThrow(NotFoundException);
  });
});

// ─── startTaskById ────────────────────────────────────────────────────────────

describe('WorkflowsService — startTaskById', () => {
  it('sets task status to in_progress', async () => {
    const db = makeDb({
      queryOne: jest.fn().mockResolvedValue(TASK),
      query: jest.fn().mockResolvedValue([]),
    });
    const svc = await buildService(db);
    const result = await svc.startTaskById('task-1', ORG, { role: 'patient', patientId: PATIENT });
    expect(result.status).toBe('in_progress');
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("status='in_progress'"),
      expect.any(Array),
    );
  });

  it('throws NotFoundException when task not found', async () => {
    const db = makeDb({ queryOne: jest.fn().mockResolvedValue(null) });
    const svc = await buildService(db);
    await expect(
      svc.startTaskById('missing', ORG, { role: 'patient', patientId: PATIENT }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when patient tries to access another patient task', async () => {
    const db = makeDb({
      queryOne: jest.fn().mockResolvedValue({ ...TASK, patient_id: 'pt-other' }),
    });
    const svc = await buildService(db);
    await expect(
      svc.startTaskById('task-1', ORG, { role: 'patient', patientId: PATIENT }),
    ).rejects.toThrow(NotFoundException);
  });
});

// ─── completeWorkflowTask ─────────────────────────────────────────────────────

describe('WorkflowsService — completeWorkflowTask', () => {
  it('marks task completed and auto-completes workflow when all required tasks done', async () => {
    const completedTask = { ...TASK, id: 'task-1', status: 'completed', is_required: true };
    const db = makeDb({
      query: jest.fn()
        .mockResolvedValueOnce([])                     // UPDATE task
        .mockResolvedValueOnce([completedTask])        // SELECT all tasks
        .mockResolvedValueOnce(null),                  // UPDATE workflow status
      queryOne: jest.fn().mockResolvedValue({ ...WORKFLOW, status: 'completed' }),
    });
    const svc = await buildService(db);
    const result = await svc.completeWorkflowTask('task-1', 'wf-1', ORG);
    expect(result.task_completed).toBe(true);
    expect(result.workflow_completed).toBe(true);
  });
});

// ─── listPatientHomework ──────────────────────────────────────────────────────

describe('WorkflowsService — listPatientHomework', () => {
  it('returns mapped homework items for patient', async () => {
    const raw = {
      id: 'task-hw-1',
      name: 'Breathing exercises',
      workflow_title: 'Daily Exercises',
      assigned_date: new Date().toISOString(),
      assigned_by: 'Dr. Smith',
      due_date: null,
      status: 'pending',
      completed_at: null,
      metadata: { description: 'Do 5 minutes', estimated_mins: 5, category: 'exercises', reflection_prompts: [] },
    };
    const db = makeDb({ query: jest.fn().mockResolvedValue([raw]) });
    const svc = await buildService(db);
    const result = await svc.listPatientHomework(ORG, PATIENT);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Breathing exercises');
    expect(result[0].status).toBe('pending');
    expect(result[0].estimated_mins).toBe(5);
  });
});

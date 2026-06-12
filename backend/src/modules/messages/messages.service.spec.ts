import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MessagesService } from './messages.service';
import { DatabaseService } from '../../database/database.service';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeDb(overrides: Partial<DatabaseService> = {}): jest.Mocked<DatabaseService> {
  return {
    queryOne: jest.fn().mockResolvedValue(null),
    execute: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as jest.Mocked<DatabaseService>;
}

function makeEmitter(): jest.Mocked<EventEmitter2> {
  return { emit: jest.fn() } as unknown as jest.Mocked<EventEmitter2>;
}

async function buildService(
  db: jest.Mocked<DatabaseService>,
  emitter?: jest.Mocked<EventEmitter2>,
): Promise<MessagesService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      MessagesService,
      { provide: DatabaseService, useValue: db },
      { provide: EventEmitter2, useValue: emitter ?? makeEmitter() },
    ],
  }).compile();
  return module.get(MessagesService);
}

const THERAPIST_USER = {
  id: 'user-th-1',
  role: 'therapist',
  therapist_profile_id: 'th-1',
  patient_profile_id: null,
};
const PATIENT_USER = {
  id: 'user-pt-1',
  role: 'patient',
  therapist_profile_id: null,
  patient_profile_id: 'pt-1',
};
const CONV = {
  id: 'conv-1',
  patient_id: 'pt-1',
  therapist_id: 'th-1',
  organization_id: 'org-1',
  patient_user_id: 'user-pt-1',
  therapist_user_id: 'user-th-1',
};

// ─── listConversations ───────────────────────────────────────────────────────

describe('MessagesService — listConversations', () => {
  it('returns mapped conversations with correct name (other participant)', async () => {
    const raw = [{
      ...CONV,
      type: 'patient_therapist',
      status: 'active',
      priority: null,
      last_message: 'Hello',
      last_message_at: new Date(),
      unread_count: '2',
      patient_name: 'Jane Patient',
      therapist_name: 'Dr Smith',
    }];
    const db = makeDb({ query: jest.fn().mockResolvedValue(raw) });
    const service = await buildService(db);
    const result = await service.listConversations('user-th-1', 'org-1');
    expect(result[0].unread_count).toBe(2);
    // Therapist sees patient's name
    expect(result[0].name).toBe('Jane Patient');
  });

  it('patient side sees therapist name', async () => {
    const raw = [{
      ...CONV,
      type: 'patient_therapist',
      status: 'active',
      priority: null,
      last_message: null,
      last_message_at: null,
      unread_count: '0',
      patient_name: 'Jane Patient',
      therapist_name: 'Dr Smith',
    }];
    const db = makeDb({ query: jest.fn().mockResolvedValue(raw) });
    const service = await buildService(db);
    const result = await service.listConversations('user-pt-1', 'org-1');
    expect(result[0].name).toBe('Dr Smith');
  });

  it('returns empty array when no conversations', async () => {
    const db = makeDb({ query: jest.fn().mockResolvedValue([]) });
    const service = await buildService(db);
    const result = await service.listConversations('user-1', 'org-1');
    expect(result).toEqual([]);
  });
});

// ─── createOrGetConversation ─────────────────────────────────────────────────

describe('MessagesService — createOrGetConversation', () => {
  it('throws NotFoundException when either participant not found', async () => {
    const db = makeDb({ queryOne: jest.fn().mockResolvedValue(null) });
    const service = await buildService(db);
    await expect(
      service.createOrGetConversation('user-1', 'org-1', { participant_id: 'user-2' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when both users are same role (e.g. two therapists)', async () => {
    const db = makeDb({
      queryOne: jest.fn()
        .mockResolvedValueOnce(THERAPIST_USER)
        .mockResolvedValueOnce(THERAPIST_USER),
    });
    const service = await buildService(db);
    await expect(
      service.createOrGetConversation('user-th-1', 'org-1', { participant_id: 'user-th-2' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates or returns conversation for therapist + patient pair', async () => {
    const db = makeDb({
      queryOne: jest.fn()
        .mockResolvedValueOnce(THERAPIST_USER)
        .mockResolvedValueOnce(PATIENT_USER)
        .mockResolvedValueOnce(CONV),
    });
    const service = await buildService(db);
    const result = await service.createOrGetConversation('user-th-1', 'org-1', {
      participant_id: 'user-pt-1',
    });
    expect(result).toBeDefined();
  });
});

// ─── sendMessage ─────────────────────────────────────────────────────────────

describe('MessagesService — sendMessage', () => {
  it('throws NotFoundException when conversation not found', async () => {
    const db = makeDb({ queryOne: jest.fn().mockResolvedValue(null) });
    const service = await buildService(db);
    await expect(
      service.sendMessage('conv-99', 'user-1', 'org-1', { content: 'Hello' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when user is not a participant', async () => {
    const db = makeDb({
      queryOne: jest.fn().mockResolvedValue({
        ...CONV,
        patient_user_id: 'user-pt-1',
        therapist_user_id: 'user-th-1',
      }),
    });
    const service = await buildService(db);
    await expect(
      service.sendMessage('conv-1', 'user-outsider', 'org-1', { content: 'Hello' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('persists message and emits message.sent event', async () => {
    const db = makeDb({
      queryOne: jest.fn()
        .mockResolvedValueOnce({ ...CONV, patient_user_id: 'user-pt-1', therapist_user_id: 'user-th-1' })
        .mockResolvedValueOnce({ id: 'msg-1', content: 'Hello', conversation_id: 'conv-1', sender_id: 'user-th-1', read: false, created_at: new Date() }),
    });
    const emitter = makeEmitter();
    const service = await buildService(db, emitter);
    const result = await service.sendMessage('conv-1', 'user-th-1', 'org-1', { content: 'Hello' });
    expect(result).toBeDefined();
    expect(emitter.emit).toHaveBeenCalledWith('message.sent', expect.objectContaining({
      conversationId: 'conv-1',
    }));
  });
});

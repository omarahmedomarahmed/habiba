import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { DatabaseService } from '../../database/database.service';
import { v4 as uuidv4 } from 'uuid';

export type TaskType =
  | 'soap_note'
  | 'dap_note'
  | 'birp_note'
  | 'session_summary'
  | 'memory_extraction'
  | 'risk_assessment'
  | 'copilot_suggestions'
  | 'emotional_analysis'
  | 'embedding'
  | 'transcription'
  | 'chat'
  | 'assistant';

export interface ModelGatewayRequest {
  task_type: TaskType;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  max_tokens?: number;
  json_mode?: boolean;
  session_id?: string;
  patient_id?: string;
  organization_id?: string;
  user_id?: string;
}

export interface ModelGatewayResponse {
  content: string;
  model_used: string;
  provider: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
  request_id: string;
}

@Injectable()
export class ModelGatewayService {
  private readonly logger = new Logger(ModelGatewayService.name);
  private openai: OpenAI;

  // Task-to-model routing config
  private readonly modelRouting: Record<TaskType, { provider: string; model: string; temp: number }> = {
    soap_note: { provider: 'openai', model: 'gpt-4o', temp: 0.3 },
    dap_note: { provider: 'openai', model: 'gpt-4o', temp: 0.3 },
    birp_note: { provider: 'openai', model: 'gpt-4o', temp: 0.3 },
    session_summary: { provider: 'openai', model: 'gpt-4o', temp: 0.4 },
    memory_extraction: { provider: 'openai', model: 'gpt-4o', temp: 0.2 },
    risk_assessment: { provider: 'openai', model: 'gpt-4o', temp: 0.1 },
    copilot_suggestions: { provider: 'openai', model: 'gpt-4o-mini', temp: 0.7 },
    emotional_analysis: { provider: 'openai', model: 'gpt-4o-mini', temp: 0.2 },
    embedding: { provider: 'openai', model: 'text-embedding-3-small', temp: 0 },
    transcription: { provider: 'openai', model: 'whisper-1', temp: 0 },
    chat: { provider: 'openai', model: 'gpt-4o-mini', temp: 0.8 },
    assistant: { provider: 'openai', model: 'gpt-4o-mini', temp: 0.4 },
  };

  // Model costs per 1K tokens (USD)
  private readonly modelCosts: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
    'text-embedding-3-small': { input: 0.00002, output: 0 },
    'whisper-1': { input: 0.006, output: 0 },
  };

  constructor(
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
  ) {
    const apiKey = this.config.get<string>('openai.apiKey');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  async complete(req: ModelGatewayRequest): Promise<ModelGatewayResponse> {
    const { provider, model, temp } = this.modelRouting[req.task_type] || this.modelRouting.chat;
    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      let content: string;
      let inputTokens = 0;
      let outputTokens = 0;

      if (!this.openai) {
        // Mock response for development without API key
        content = this.getMockResponse(req.task_type);
        inputTokens = 100;
        outputTokens = 200;
      } else {
        const completion = await this.openai.chat.completions.create({
          model,
          messages: req.messages,
          temperature: req.temperature ?? temp,
          max_tokens: req.max_tokens ?? 4096,
          response_format: req.json_mode ? { type: 'json_object' } : { type: 'text' },
        });

        content = completion.choices[0]?.message?.content || '';
        inputTokens = completion.usage?.prompt_tokens || 0;
        outputTokens = completion.usage?.completion_tokens || 0;
      }

      const latencyMs = Date.now() - startTime;
      const costs = this.modelCosts[model] || { input: 0, output: 0 };
      const costUsd = (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output;

      // Log to database
      await this.logRequest({
        requestId, provider, model, taskType: req.task_type,
        inputTokens, outputTokens, costUsd, latencyMs,
        sessionId: req.session_id, patientId: req.patient_id,
        orgId: req.organization_id, userId: req.user_id,
        status: 'success',
      });

      return {
        content,
        model_used: model,
        provider,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costUsd,
        latency_ms: latencyMs,
        request_id: requestId,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      this.logger.error(`Model gateway error for ${req.task_type}:`, error.message);

      await this.logRequest({
        requestId, provider, model, taskType: req.task_type,
        inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs,
        sessionId: req.session_id, patientId: req.patient_id,
        orgId: req.organization_id, userId: req.user_id,
        status: 'failure', errorMessage: error.message,
      });

      throw error;
    }
  }

  async embed(text: string): Promise<number[]> {
    if (!this.openai) {
      // Return mock embedding for dev
      return Array(1536).fill(0).map(() => Math.random() - 0.5);
    }

    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    return response.data[0].embedding;
  }

  async transcribe(audioBuffer: Buffer, language?: string): Promise<string> {
    if (!this.openai) {
      return '[Transcription requires OpenAI API key]';
    }

    const response = await this.openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: new File([audioBuffer as unknown as BlobPart], 'audio.webm', { type: 'audio/webm' }),
      language,
    });

    return response.text;
  }

  private getMockResponse(taskType: TaskType): string {
    const mocks: Partial<Record<TaskType, string>> = {
      soap_note: JSON.stringify({
        subjective: 'Patient reports feeling anxious and overwhelmed with work stress. Sleep has been disrupted for the past 2 weeks.',
        objective: 'Patient presented as alert and cooperative. Moderate anxiety evident. Mood appeared dysthymic.',
        assessment: 'Generalized Anxiety Disorder with work-related stressors. Patient demonstrates good insight.',
        plan: 'Continue CBT techniques. Practice mindfulness exercises daily. Schedule follow-up in 2 weeks.',
      }),
      session_summary: 'Session focused on work-related anxiety and stress management techniques. Patient demonstrated good engagement with CBT exercises.',
      memory_extraction: JSON.stringify([
        { type: 'symptom', title: 'Work-related anxiety', content: 'Patient reports anxiety triggered by work deadlines and performance pressure.' },
        { type: 'trigger', title: 'Sleep disruption', content: 'Patient experiencing insomnia for 2+ weeks correlated with work stress.' },
      ]),
      copilot_suggestions: JSON.stringify([
        { type: 'question', content: 'How has the sleep disruption been affecting your daily functioning?' },
        { type: 'observation', content: 'Consider exploring the specific work situations triggering the anxiety.' },
      ]),
    };
    return mocks[taskType] || 'AI response generated successfully.';
  }

  private async logRequest(data: any) {
    try {
      await this.db.execute(
        `INSERT INTO ai_request_logs (
          id, organization_id, user_id, patient_id, session_id,
          request_type, model_id, input_tokens, output_tokens,
          cost_usd, latency_ms, status, error_message, request_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          data.requestId, data.orgId || null, data.userId || null,
          data.patientId || null, data.sessionId || null,
          data.taskType, data.model, data.inputTokens, data.outputTokens,
          data.costUsd, data.latencyMs, data.status,
          data.errorMessage || null, data.requestId,
        ],
      );
    } catch (err) {
      this.logger.warn('Failed to log AI request:', err.message);
    }
  }
}

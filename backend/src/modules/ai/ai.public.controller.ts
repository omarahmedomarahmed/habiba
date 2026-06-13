/**
 * AI Public Controller
 *
 * Routes in this controller are public (no authentication required).
 * Rate limiting should be applied at the infrastructure level (nginx/Cloudflare).
 *
 * Endpoints:
 *   POST /ai/chat/anonymous — Free anonymous AI chat for unauthenticated users
 *     - Max 10 messages per session (enforced by frontend; backend trusts the count)
 *     - No PHI stored; no patient data attached
 *     - Crisis keywords → system adds 988 helpline context automatically
 */

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ModelGatewayService } from './model-gateway.service';

interface AnonymousChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnonymousChatDto {
  message: string;
  history?: AnonymousChatMessage[];
  context?: string; // optional page/flow context (e.g. "find-therapist", "pricing")
}

const SYSTEM_PROMPT = `You are a supportive mental health AI assistant for 24Therapy.ai. 
You are NOT a licensed therapist and cannot provide therapy, diagnosis, or medical advice.
Your role is to:
- Provide emotional support and a compassionate, non-judgmental space
- Share evidence-based coping strategies (breathing exercises, grounding techniques, CBT concepts)
- Help users identify when professional therapy might be beneficial
- Always recommend licensed therapists for serious concerns

Guidelines:
- Keep responses concise (2-4 paragraphs max)
- Be warm, empathetic, and human
- Never diagnose conditions
- If someone mentions self-harm, suicide, or crisis, ALWAYS provide the 988 Suicide & Crisis Lifeline
- For complex issues, gently suggest speaking with a licensed therapist
- You can suggest the user create an account on 24Therapy.ai to access licensed therapists`;

const CRISIS_KEYWORDS = [
  'suicide', 'kill myself', 'hurt myself', 'self-harm', 'self harm',
  'end my life', 'want to die', 'don\'t want to live', 'cutting myself',
  'overdose', 'no reason to live',
];

@ApiTags('ai-public')
@Controller('ai')
export class AIPublicController {
  constructor(private readonly modelGateway: ModelGatewayService) {}

  @Post('chat/anonymous')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Anonymous AI mental health chat (no auth required)',
    description: 'Public AI chat endpoint. Max 10 messages per session. No PHI stored.',
  })
  async anonymousChat(@Body() body: AnonymousChatDto) {
    if (!body.message || typeof body.message !== 'string') {
      throw new BadRequestException('message is required');
    }

    const userMessage = body.message.trim().slice(0, 2000); // Max 2000 chars
    if (!userMessage) {
      throw new BadRequestException('message cannot be empty');
    }

    const history = (body.history || []).slice(-10); // Max 10 history messages

    // Check for crisis keywords
    const lowerMessage = userMessage.toLowerCase();
    const isCrisis = CRISIS_KEYWORDS.some((kw) => lowerMessage.includes(kw));

    // Build messages array
    let systemContent = SYSTEM_PROMPT;
    if (body.context) {
      systemContent += `\n\nContext: The user arrived from the "${body.context}" section of the platform. Tailor your responses accordingly (e.g., if "find-therapist", emphasize connecting with a licensed therapist).`;
    }
    if (isCrisis) {
      systemContent += `\n\nCRITICAL: The user's message contains language indicating a potential crisis or self-harm. 
You MUST:
1. Respond with empathy and compassion
2. Prominently include the 988 Suicide & Crisis Lifeline (call or text 988)
3. Mention the Crisis Text Line: text HOME to 741741
4. Encourage them to reach out to a trusted person
5. Do NOT dismiss their feelings`;
    }

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemContent },
      ...history.map((h) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user', content: userMessage },
    ];

    try {
      const response = await this.modelGateway.complete({
        task_type: 'chat',
        messages,
        temperature: 0.75,
        max_tokens: 512,
        // No session_id, patient_id, or org_id — anonymous session
      });

      return {
        reply: response.content,
        is_crisis: isCrisis,
        model: response.model_used,
        // Don't expose cost/token data to public
      };
    } catch {
      // Fallback response if AI service is unavailable
      const fallback = isCrisis
        ? "I can hear that you're going through something very difficult. Please reach out to the 988 Suicide & Crisis Lifeline by calling or texting **988**. You can also text HOME to **741741** (Crisis Text Line). You don't have to face this alone — help is available 24/7."
        : "I'm here to listen and support you. While I'm an AI and not a licensed therapist, I can offer a compassionate space. Could you tell me more about what you're experiencing? And if you'd like to speak with a licensed professional, 24Therapy.ai can connect you with one.";

      return {
        reply: fallback,
        is_crisis: isCrisis,
        model: 'fallback',
      };
    }
  }
}

// Reviewed: 2026-06-13 — 24Therapy audit

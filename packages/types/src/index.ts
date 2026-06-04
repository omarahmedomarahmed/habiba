// ============================================================
// 24Therapy.ai — Shared TypeScript Types
// ============================================================

// ---- API Response ----
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    status: number;
    details?: unknown;
  };
  meta: {
    request_id: string;
    timestamp: string;
    version: string;
  };
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    cursor?: string;
    next_cursor?: string;
    has_more: boolean;
    total?: number;
    limit: number;
  };
}

// ---- User Roles ----
export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'manager'
  | 'therapist'
  | 'assistant'
  | 'billing'
  | 'support'
  | 'patient';

export type UserStatus = 'active' | 'inactive' | 'invited' | 'suspended';

// ---- Organization ----
export type OrgType = 'solo' | 'practice' | 'clinic' | 'hospital' | 'enterprise' | 'partner';
export type OrgStatus = 'active' | 'trial' | 'suspended' | 'cancelled' | 'pending';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  organization_type: OrgType;
  plan_id?: string;
  status: OrgStatus;
  country?: string;
  timezone: string;
  currency: string;
  website?: string;
  logo_url?: string;
  primary_color?: string;
  custom_domain?: string;
  trial_ends_at?: string;
  created_at: string;
  updated_at: string;
}

// ---- User ----
export interface User {
  id: string;
  organization_id: string;
  email: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  role: UserRole;
  status: UserStatus;
  email_verified_at?: string;
  mfa_enabled: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

// ---- Therapist ----
export type TherapistStatus = 'available' | 'busy' | 'offline' | 'on_break';
export type VerificationStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'suspended';

export interface Therapist {
  id: string;
  organization_id: string;
  user_id: string;
  public_slug?: string;
  display_name?: string;
  title?: string;
  license_number?: string;
  license_country?: string;
  license_type?: string;
  license_status: string;
  specializations: string[];
  languages: string[];
  years_experience?: number;
  bio?: string;
  education: EducationItem[];
  certifications: CertificationItem[];
  therapy_modalities: string[];
  session_types: string[];
  session_duration_mins: number;
  session_fee_min?: number;
  session_fee_max?: number;
  currency: string;
  availability_status: TherapistStatus;
  marketplace_enabled: boolean;
  verification_status: VerificationStatus;
  rating?: number;
  review_count: number;
  total_sessions: number;
  radar_active: boolean;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface EducationItem {
  degree: string;
  institution: string;
  year: number;
}

export interface CertificationItem {
  name: string;
  issuer: string;
  year: number;
  expiry?: number;
}

// ---- Patient ----
export type PatientStatus = 'active' | 'inactive' | 'discharged' | 'waitlist' | 'on_hold';

export interface Patient {
  id: string;
  organization_id: string;
  primary_therapist_id?: string;
  user_id?: string;
  first_name: string;
  last_name?: string;
  preferred_name?: string;
  date_of_birth?: string;
  gender?: string;
  pronouns?: string;
  email?: string;
  phone?: string;
  status: PatientStatus;
  anonymous_mode: boolean;
  on_medication: boolean;
  source?: string;
  total_sessions: number;
  tags: string[];
  last_session_at?: string;
  intake_completed_at?: string;
  created_at: string;
  updated_at: string;
}

// ---- Session ----
export type SessionType = 'standard' | 'radar' | 'group' | 'phone' | 'in_person' | 'intake' | 'follow_up';
export type SessionModality = 'video' | 'audio_only' | 'phone' | 'in_person';
export type SessionStatus = 'scheduled' | 'waiting' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled';

export interface Session {
  id: string;
  organization_id: string;
  therapist_id: string;
  patient_id: string;
  session_type: SessionType;
  modality: SessionModality;
  status: SessionStatus;
  scheduled_at?: string;
  started_at?: string;
  ended_at?: string;
  duration_minutes?: number;
  session_number?: number;
  title?: string;
  radar_session: boolean;
  recording_enabled: boolean;
  scribe_enabled: boolean;
  video_room_id?: string;
  video_room_url?: string;
  pre_session_notes?: string;
  billing_status: string;
  fee_charged?: number;
  created_at: string;
  updated_at: string;
}

// ---- AI Notes ----
export type NoteFormat = 'soap' | 'dap' | 'birp' | 'narrative' | 'custom';
export type NoteStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'archived';

export interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface DAPNote {
  data: string;
  assessment: string;
  plan: string;
}

export interface BIRPNote {
  behavior: string;
  intervention: string;
  response: string;
  plan: string;
}

export interface AISessionNote {
  id: string;
  session_id: string;
  patient_id: string;
  therapist_id: string;
  organization_id: string;
  note_format: NoteFormat;
  structured_content: SOAPNote | DAPNote | BIRPNote | Record<string, string>;
  raw_content?: string;
  status: NoteStatus;
  version: number;
  approved_by?: string;
  approved_at?: string;
  ai_model_used?: string;
  prompt_version?: string;
  generation_latency_ms?: number;
  token_count?: number;
  created_at: string;
  updated_at: string;
}

// ---- Transcript ----
export interface TranscriptSegment {
  id: string;
  transcript_id: string;
  session_id: string;
  speaker: 'therapist' | 'patient' | 'family' | 'interpreter' | 'unknown';
  speaker_label?: string;
  start_time_ms: number;
  end_time_ms: number;
  text: string;
  confidence?: number;
  sequence_number: number;
}

// ---- Assessment ----
export interface AssessmentResult {
  id: string;
  patient_id: string;
  therapist_id: string;
  session_id?: string;
  template_id: string;
  template_code: string;
  total_score?: number;
  severity_label?: string;
  completed_at?: string;
  status: string;
  created_at: string;
}

// ---- Radar ----
export type RadarUrgency = 'low' | 'medium' | 'high' | 'emergency';

export interface RadarRequest {
  id: string;
  organization_id?: string;
  patient_id?: string;
  urgency: RadarUrgency;
  urgency_reason?: string;
  presenting_issues: string[];
  preferred_language: string;
  preferred_gender?: string;
  preferred_session_type: string;
  budget_per_session?: number;
  max_wait_minutes: number;
  status: string;
  match_count: number;
  session_id?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

// ---- Billing ----
export interface SubscriptionPlan {
  id: string;
  plan_key: string;
  name: string;
  description?: string;
  monthly_price_usd: number;
  annual_price_usd: number;
  max_therapists?: number;
  max_patients?: number;
  max_sessions_month?: number;
  ai_notes_included?: number;
  features: Record<string, boolean | string | number>;
  is_active: boolean;
}

export interface Subscription {
  id: string;
  organization_id: string;
  plan_id: string;
  billing_cycle: 'monthly' | 'annual';
  status: 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'archived';
  trial_ends_at?: string;
  current_period_start?: string;
  current_period_end?: string;
  stripe_subscription_id?: string;
  created_at: string;
  updated_at: string;
}

// ---- Memory ----
export type MemoryType =
  | 'symptom' | 'goal' | 'relationship' | 'life_event' | 'medication'
  | 'risk' | 'treatment' | 'strength' | 'protective_factor' | 'preference'
  | 'belief' | 'behavior' | 'trigger' | 'coping' | 'general';

export interface PatientMemory {
  id: string;
  patient_id: string;
  therapist_id?: string;
  organization_id: string;
  memory_type: MemoryType;
  title: string;
  content: string;
  confidence_score?: number;
  source_session_id?: string;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
}

// ---- Marketplace ----
export interface MarketplaceListing {
  id: string;
  therapist_id: string;
  organization_id: string;
  headline?: string;
  description?: string;
  specializations: string[];
  languages: string[];
  session_fee_min?: number;
  session_fee_max?: number;
  currency: string;
  session_types: string[];
  rating?: number;
  review_count: number;
  is_active: boolean;
  is_featured: boolean;
  profile_photo_url?: string;
  video_intro_url?: string;
  created_at: string;
  updated_at: string;
}

// ---- Auth ----
export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
}

export interface LoginRequest {
  email: string;
  password: string;
  organization_slug?: string;
  mfa_code?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role?: UserRole;
  organization_name?: string;
  organization_slug?: string;
}

// ---- Dashboard ----
export interface TherapistDashboardStats {
  sessions_today: number;
  sessions_this_week: number;
  active_patients: number;
  pending_notes: number;
  revenue_this_month: number;
  radar_requests_pending: number;
  ai_time_saved_hours: number;
}

export interface PatientDashboardStats {
  upcoming_sessions: number;
  completed_sessions: number;
  active_goals: number;
  mood_trend: number[];
  last_assessment_date?: string;
}

// ---- Notifications ----
export interface Notification {
  id: string;
  user_id: string;
  organization_id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read_at?: string;
  created_at: string;
}

// ---- Risk ----
export type RiskLevel = 'low' | 'moderate' | 'elevated' | 'high' | 'critical';
export type RiskType = 'self_harm' | 'suicide' | 'violence' | 'substance' | 'medical' | 'general';

export interface RiskAssessment {
  id: string;
  patient_id: string;
  therapist_id?: string;
  session_id?: string;
  organization_id: string;
  risk_type: RiskType;
  risk_level: RiskLevel;
  indicators: string[];
  ai_detected: boolean;
  ai_confidence?: number;
  clinical_notes?: string;
  action_taken?: string;
  safety_plan?: string;
  resolved_at?: string;
  created_at: string;
}

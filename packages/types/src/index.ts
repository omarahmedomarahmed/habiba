// ============================================================
// 24Therapy.ai — Shared TypeScript Types
// Mental Health Operating System — Platform-wide Type Definitions
// ============================================================

// ─── API Response ─────────────────────────────────────────────────────────────

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
    offset?: number;
  };
}

export interface BulkOperationResult {
  success_count: number;
  failure_count: number;
  errors: Array<{ id: string; error: string }>;
}

// ─── User & Auth ──────────────────────────────────────────────────────────────

export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'manager'
  | 'therapist'
  | 'assistant'
  | 'billing'
  | 'support'
  | 'patient';

export type UserStatus = 'active' | 'inactive' | 'invited' | 'suspended' | 'pending_verification';

export type MFAMethod = 'totp' | 'sms' | 'email' | 'backup_codes';

export interface User {
  id: string;
  organization_id: string;
  email: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  avatar_url?: string;
  role: UserRole;
  status: UserStatus;
  email_verified_at?: string;
  phone_verified_at?: string;
  mfa_enabled: boolean;
  mfa_methods: MFAMethod[];
  last_login_at?: string;
  last_login_ip?: string;
  failed_login_attempts: number;
  locked_until?: string;
  password_changed_at?: string;
  preferences: UserPreferences;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  date_format: string;
  notifications_email: boolean;
  notifications_sms: boolean;
  notifications_push: boolean;
  session_reminders_minutes: number[];
  ai_suggestions_enabled: boolean;
  compact_view: boolean;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
  scope?: string;
}

export interface AuthSession {
  user: User;
  tokens: AuthTokens;
  organization: Organization;
  permissions: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
  organization_slug?: string;
  mfa_code?: string;
  remember_me?: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role?: UserRole;
  organization_name?: string;
  organization_slug?: string;
  referral_code?: string;
  phone?: string;
}

export interface PasswordResetRequest {
  token: string;
  new_password: string;
  confirm_password: string;
}

export interface MFASetupResult {
  method: MFAMethod;
  secret?: string;
  qr_code_url?: string;
  backup_codes?: string[];
}

// ─── Organization ─────────────────────────────────────────────────────────────

export type OrgType = 'solo' | 'practice' | 'clinic' | 'hospital' | 'enterprise' | 'partner';
export type OrgStatus = 'active' | 'trial' | 'suspended' | 'cancelled' | 'pending';
export type OrgPlan = 'solo' | 'professional' | 'group' | 'enterprise' | 'health_system';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  organization_type: OrgType;
  plan_id?: string;
  plan: OrgPlan;
  status: OrgStatus;
  country?: string;
  timezone: string;
  currency: string;
  website?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  custom_domain?: string;
  white_label_enabled: boolean;
  sso_enabled: boolean;
  api_access: boolean;
  hipaa_baa_signed: boolean;
  hipaa_baa_signed_at?: string;
  data_region: 'us' | 'eu' | 'ca' | 'au';
  trial_ends_at?: string;
  therapist_count: number;
  patient_count: number;
  mrr: number;
  health_score: number;
  ehr_integrations: string[];
  features_enabled: string[];
  support_tier: 'standard' | 'priority' | 'enterprise' | 'dedicated';
  created_at: string;
  updated_at: string;
}

export interface OrganizationSettings {
  org_id: string;
  session_default_duration_mins: number;
  note_auto_approve: boolean;
  require_supervisor_review: boolean;
  allow_patient_self_schedule: boolean;
  intake_form_enabled: boolean;
  billing_enabled: boolean;
  insurance_billing_enabled: boolean;
  marketplace_enabled: boolean;
  radar_enabled: boolean;
  ai_scribe_enabled: boolean;
  risk_monitoring_enabled: boolean;
  group_sessions_enabled: boolean;
  telehealth_platform: 'daily_co' | 'twilio' | 'zoom' | 'custom';
  ehr_sync_enabled: boolean;
  ehr_system?: string;
  audit_logging_level: 'minimal' | 'standard' | 'full';
  data_retention_days: number;
  allowed_ip_ranges?: string[];
  updated_at: string;
}

// ─── Therapist ────────────────────────────────────────────────────────────────

export type TherapistStatus = 'available' | 'busy' | 'offline' | 'on_break' | 'in_session';
export type VerificationStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'suspended' | 'expired';
export type LicenseType = 'LCSW' | 'LMFT' | 'LPC' | 'PsyD' | 'PhD' | 'MD' | 'LMHC' | 'LCPC' | 'NP' | 'other';

export interface Therapist {
  id: string;
  organization_id: string;
  user_id: string;
  public_slug?: string;
  display_name?: string;
  title?: string;
  license_number?: string;
  license_state?: string;
  license_country?: string;
  license_type?: LicenseType;
  license_status: 'active' | 'inactive' | 'expired' | 'pending';
  license_expiry?: string;
  npi_number?: string;
  specializations: string[];
  conditions_treated: string[];
  populations_served: string[];
  languages: string[];
  years_experience?: number;
  bio?: string;
  profile_video_url?: string;
  education: EducationItem[];
  certifications: CertificationItem[];
  therapy_modalities: string[];
  therapy_approaches: string[];
  session_types: string[];
  session_duration_mins: number;
  session_fee_min?: number;
  session_fee_max?: number;
  sliding_scale_available: boolean;
  currency: string;
  availability_status: TherapistStatus;
  accepts_insurance: boolean;
  insurance_panels: string[];
  marketplace_enabled: boolean;
  marketplace_listed: boolean;
  verification_status: VerificationStatus;
  background_check_status?: string;
  background_check_date?: string;
  rating?: number;
  review_count: number;
  total_sessions: number;
  radar_active: boolean;
  radar_radius_miles?: number;
  timezone: string;
  next_available?: string;
  supervisor_id?: string;
  ai_preferences: TherapistAIPreferences;
  created_at: string;
  updated_at: string;
}

export interface TherapistAIPreferences {
  scribe_enabled: boolean;
  copilot_enabled: boolean;
  risk_monitoring_enabled: boolean;
  memory_enabled: boolean;
  note_format_default: NoteFormat;
  copilot_verbosity: 'minimal' | 'moderate' | 'detailed';
  risk_alert_threshold: RiskLevel;
  auto_extract_memories: boolean;
  session_prep_enabled: boolean;
}

export interface EducationItem {
  degree: string;
  institution: string;
  year: number;
  field_of_study?: string;
}

export interface CertificationItem {
  name: string;
  issuer: string;
  year: number;
  expiry?: number;
  credential_id?: string;
}

export interface TherapistAvailability {
  therapist_id: string;
  timezone: string;
  schedule: WeeklySchedule;
  blocked_dates: string[];
  buffer_minutes_between_sessions: number;
  max_sessions_per_day: number;
  updated_at: string;
}

export interface WeeklySchedule {
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
}

export interface DaySchedule {
  enabled: boolean;
  slots: TimeSlot[];
}

export interface TimeSlot {
  start: string; // HH:MM
  end: string;   // HH:MM
}

// ─── Patient ──────────────────────────────────────────────────────────────────

export type PatientStatus = 'active' | 'inactive' | 'discharged' | 'waitlist' | 'on_hold' | 'crisis';
export type InsuranceType = 'insurance' | 'self_pay' | 'sliding_scale' | 'eap' | 'medicare' | 'medicaid';

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
  ethnicity?: string;
  preferred_language?: string;
  email?: string;
  phone?: string;
  address?: PatientAddress;
  emergency_contact?: EmergencyContact;
  status: PatientStatus;
  anonymous_mode: boolean;
  payment_type: InsuranceType;
  insurance?: InsuranceInfo;
  on_medication: boolean;
  medications: PatientMedication[];
  diagnoses: PatientDiagnosis[];
  source?: string;
  referral_source?: string;
  total_sessions: number;
  risk_level: RiskLevel;
  risk_flags: string[];
  tags: string[];
  how_heard?: string;
  therapy_goals?: string;
  presenting_concerns: string[];
  intake_completed_at?: string;
  last_session_at?: string;
  next_session_at?: string;
  portal_access_enabled: boolean;
  portal_last_login?: string;
  ai_context_summary?: string;
  created_at: string;
  updated_at: string;
}

export interface PatientAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  can_share_info: boolean;
}

export interface InsuranceInfo {
  provider_name: string;
  member_id: string;
  group_number?: string;
  plan_name?: string;
  copay_amount?: number;
  deductible_amount?: number;
  deductible_met?: number;
  verification_status?: 'pending' | 'verified' | 'failed';
  verified_at?: string;
}

export interface PatientMedication {
  id: string;
  name: string;
  dosage?: string;
  frequency?: string;
  prescribing_provider?: string;
  start_date?: string;
  end_date?: string;
  reason?: string;
  side_effects?: string;
  status: 'active' | 'discontinued' | 'as_needed';
  added_by: 'therapist' | 'patient' | 'intake';
  created_at: string;
}

export interface PatientDiagnosis {
  id: string;
  icd_code: string;
  icd_description: string;
  dsm_code?: string;
  severity?: 'mild' | 'moderate' | 'severe';
  primary: boolean;
  date_diagnosed?: string;
  diagnosed_by?: string;
  notes?: string;
  status: 'active' | 'resolved' | 'in_remission';
  created_at: string;
}

export interface PatientConsent {
  patient_id: string;
  consent_therapy: boolean;
  consent_therapy_signed_at?: string;
  consent_hipaa: boolean;
  consent_hipaa_signed_at?: string;
  consent_telehealth: boolean;
  consent_telehealth_signed_at?: string;
  consent_records: boolean;
  consent_records_signed_at?: string;
  consent_billing: boolean;
  consent_billing_signed_at?: string;
  esign_signature?: string;
  esign_ip?: string;
  esign_user_agent?: string;
  updated_at: string;
}

// ─── Session ──────────────────────────────────────────────────────────────────

export type SessionType = 'standard' | 'radar' | 'group' | 'phone' | 'in_person' | 'intake' | 'follow_up' | 'crisis' | 'supervision';
export type SessionModality = 'video' | 'audio_only' | 'phone' | 'in_person' | 'hybrid';
export type SessionStatus = 'scheduled' | 'waiting' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled' | 'late_cancelled';
export type NoteFormat = 'soap' | 'dap' | 'birp' | 'narrative' | 'progress' | 'custom';
export type NoteStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'archived';

export interface Session {
  id: string;
  organization_id: string;
  therapist_id: string;
  patient_id: string;
  session_type: SessionType;
  modality: SessionModality;
  status: SessionStatus;
  session_number?: number;
  title?: string;
  scheduled_at?: string;
  started_at?: string;
  ended_at?: string;
  duration_minutes?: number;
  radar_session: boolean;
  recording_enabled: boolean;
  scribe_enabled: boolean;
  copilot_enabled: boolean;
  video_room_id?: string;
  video_room_url?: string;
  waiting_room_url?: string;
  pre_session_notes?: string;
  presenting_issues?: string[];
  session_mood_start?: number;
  session_mood_end?: number;
  risk_flags_detected: string[];
  billing_status: 'not_billed' | 'ready' | 'submitted' | 'paid' | 'denied' | 'write_off';
  fee_charged?: number;
  insurance_claim_id?: string;
  cancellation_reason?: string;
  cancelled_by?: string;
  no_show_fee_charged?: boolean;
  supervisor_id?: string;
  group_session_id?: string;
  created_at: string;
  updated_at: string;
}

export interface SessionPrep {
  session_id: string;
  patient_id: string;
  therapist_id: string;
  last_session_summary?: string;
  progress_since_last?: string;
  goals_to_review: string[];
  suggested_topics: string[];
  assessment_due: boolean;
  pending_homework?: string;
  risk_flags: string[];
  ai_session_brief?: AISessionBrief;
  medication_changes?: string[];
  life_events_since_last?: string[];
  generated_at: string;
}

export interface AISessionBrief {
  executive_summary: string;
  key_themes: string[];
  clinical_focus_areas: string[];
  suggested_interventions: string[];
  questions_to_explore: string[];
  risk_considerations: string[];
  progress_indicators: ProgressIndicator[];
  memory_context_nodes: string[];
}

export interface ProgressIndicator {
  goal: string;
  metric: string;
  baseline?: number;
  current?: number;
  target?: number;
  trend: 'improving' | 'stable' | 'declining' | 'unknown';
}

// ─── Clinical Notes ───────────────────────────────────────────────────────────

export interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  risk_assessment?: string;
}

export interface DAPNote {
  data: string;
  assessment: string;
  plan: string;
  risk_assessment?: string;
}

export interface BIRPNote {
  behavior: string;
  intervention: string;
  response: string;
  plan: string;
}

export interface ProgressNote {
  session_summary: string;
  interventions_used: string[];
  patient_response: string;
  progress_toward_goals: string;
  plan_for_next: string;
  risk_assessment?: string;
}

export interface AISessionNote {
  id: string;
  session_id: string;
  patient_id: string;
  therapist_id: string;
  organization_id: string;
  note_format: NoteFormat;
  structured_content: SOAPNote | DAPNote | BIRPNote | ProgressNote | Record<string, string>;
  raw_content?: string;
  status: NoteStatus;
  version: number;
  edit_history: NoteEditRecord[];
  approved_by?: string;
  approved_at?: string;
  rejected_reason?: string;
  supervisor_review_required: boolean;
  ai_model_used?: string;
  prompt_version?: string;
  generation_latency_ms?: number;
  input_token_count?: number;
  output_token_count?: number;
  scribe_source: 'transcript' | 'manual' | 'combined' | 'template';
  custom_sections?: CustomNoteSection[];
  created_at: string;
  updated_at: string;
}

export interface NoteEditRecord {
  edited_by: string;
  edited_at: string;
  field_changed: string;
  previous_value: string;
  new_value: string;
}

export interface CustomNoteSection {
  label: string;
  content: string;
  order: number;
}

// ─── Transcript ───────────────────────────────────────────────────────────────

export interface SessionTranscript {
  id: string;
  session_id: string;
  therapist_id: string;
  patient_id: string;
  organization_id: string;
  segments: TranscriptSegment[];
  total_duration_ms: number;
  word_count: number;
  language: string;
  confidence_avg?: number;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  provider: 'deepgram' | 'whisper' | 'google' | 'azure';
  created_at: string;
  updated_at: string;
}

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
  words?: TranscriptWord[];
  sequence_number: number;
  flagged?: boolean;
  flag_reason?: string;
}

export interface TranscriptWord {
  word: string;
  start_ms: number;
  end_ms: number;
  confidence: number;
}

// ─── Mental Health Memory Layer ───────────────────────────────────────────────

export type MemoryNodeType =
  | 'symptom'
  | 'medication'
  | 'diagnosis'
  | 'life_event'
  | 'relationship'
  | 'belief'
  | 'behavior'
  | 'trigger'
  | 'coping_skill'
  | 'goal'
  | 'trauma'
  | 'strength'
  | 'concern'
  | 'progress'
  | 'insight'
  | 'treatment_response'
  | 'family_history'
  | 'substance'
  | 'sleep'
  | 'mood_pattern'
  | 'contextual_factor';

export type MemoryNodeConfidence = 'low' | 'medium' | 'high' | 'confirmed';
export type MemoryNodeStatus = 'active' | 'resolved' | 'updated' | 'retracted';
export type MemoryType = MemoryNodeType; // alias for backwards compat

export interface MemoryNode {
  id: string;
  patient_id: string;
  therapist_id: string;
  organization_id: string;
  node_type: MemoryNodeType;
  label: string;
  content: string;
  structured_data?: Record<string, unknown>;
  confidence: MemoryNodeConfidence;
  status: MemoryNodeStatus;
  source_session_id?: string;
  source_note_id?: string;
  first_observed_at: string;
  last_updated_at: string;
  times_observed: number;
  linked_node_ids: string[];
  semantic_tags: string[];
  is_ai_extracted: boolean;
  therapist_validated: boolean;
  temporal_relevance?: 'current' | 'historical' | 'recurring';
  intensity?: 'mild' | 'moderate' | 'severe';
  metadata?: Record<string, unknown>;
}

export interface MemoryNodeEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  relationship_type: EdgeRelationshipType;
  strength: number; // 0-1
  bidirectional: boolean;
  context?: string;
  created_at: string;
}

export type EdgeRelationshipType =
  | 'causes'
  | 'triggers'
  | 'worsens'
  | 'alleviates'
  | 'co_occurs_with'
  | 'precedes'
  | 'follows'
  | 'part_of'
  | 'related_to'
  | 'contradicts'
  | 'supports';

export interface KnowledgeGraph {
  patient_id: string;
  nodes: MemoryNode[];
  edges: MemoryNodeEdge[];
  cluster_count: number;
  dominant_themes: string[];
  complexity_score: number;
  generated_at: string;
}

export interface LongitudinalIntelligence {
  patient_id: string;
  therapist_id: string;
  organization_id: string;
  total_sessions: number;
  treatment_duration_weeks: number;
  primary_diagnoses: string[];
  active_symptoms: MemoryNode[];
  resolved_symptoms: MemoryNode[];
  medication_history: MemoryNode[];
  life_events: MemoryNode[];
  treatment_responses: MemoryNode[];
  strengths: MemoryNode[];
  protective_factors: MemoryNode[];
  risk_factors: MemoryNode[];
  goals: MemoryNode[];
  progress_indicators: ProgressIndicator[];
  mood_trend: MoodDataPoint[];
  symptom_trends: SymptomTrend[];
  therapeutic_alliance_score?: number;
  overall_progress: 'significant_improvement' | 'moderate_improvement' | 'minimal_improvement' | 'stable' | 'declining' | 'unknown';
  ai_narrative_summary: string;
  generated_at: string;
}

export interface MoodDataPoint {
  date: string;
  score: number; // 1-10
  session_id?: string;
  note?: string;
}

export interface SymptomTrend {
  symptom: string;
  severity_history: Array<{
    date: string;
    severity: number;
    session_id?: string;
  }>;
  trend_direction: 'improving' | 'stable' | 'worsening';
}

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

export interface AIContext {
  patient_id: string;
  therapist_id: string;
  session_id?: string;
  context_nodes: MemoryNode[];
  relevant_history: string;
  active_risk_factors: string[];
  treatment_framework: string;
  recent_changes: string[];
  session_focus_areas: string[];
  knowledge_graph_summary: string;
  longitudinal_narrative: string;
  token_estimate: number;
  generated_at: string;
}

// ─── Assessment ───────────────────────────────────────────────────────────────

export type AssessmentStatus = 'pending' | 'in_progress' | 'completed' | 'expired' | 'voided';
export type AssessmentFrequency = 'one_time' | 'weekly' | 'bi_weekly' | 'monthly' | 'quarterly' | 'as_needed';

export interface AssessmentTemplate {
  id: string;
  code: string; // PHQ9, GAD7, PCL5, MDQ, AUDIT, etc.
  name: string;
  description?: string;
  category: 'depression' | 'anxiety' | 'trauma' | 'substance' | 'suicide_risk' | 'bipolar' | 'general' | 'custom';
  scoring_type: 'sum' | 'subscale' | 'severity_band' | 'custom';
  min_score: number;
  max_score: number;
  severity_bands: SeverityBand[];
  questions: AssessmentQuestion[];
  estimated_minutes: number;
  validated: boolean;
  references?: string[];
}

export interface SeverityBand {
  label: string;
  min: number;
  max: number;
  color: string;
  clinical_action?: string;
}

export interface AssessmentQuestion {
  id: string;
  order: number;
  text: string;
  help_text?: string;
  type: 'likert' | 'yes_no' | 'multiple_choice' | 'numeric' | 'text';
  options?: AssessmentOption[];
  weight?: number;
  subscale?: string;
  required: boolean;
}

export interface AssessmentOption {
  value: number;
  label: string;
}

export interface AssessmentResult {
  id: string;
  patient_id: string;
  therapist_id: string;
  session_id?: string;
  organization_id: string;
  template_id: string;
  template_code: string;
  responses: AssessmentResponse[];
  total_score?: number;
  subscale_scores?: Record<string, number>;
  severity_label?: string;
  severity_band?: SeverityBand;
  clinical_flag: boolean;
  flag_reason?: string;
  ai_interpretation?: string;
  completed_at?: string;
  administered_by: 'therapist' | 'patient_self' | 'system';
  status: AssessmentStatus;
  compared_to_previous?: AssessmentComparison;
  created_at: string;
}

export interface AssessmentResponse {
  question_id: string;
  value: number | string;
  label?: string;
}

export interface AssessmentComparison {
  previous_result_id: string;
  previous_score: number;
  score_change: number;
  severity_change: 'improved' | 'same' | 'worsened';
  days_between: number;
}

// ─── Treatment Plan ───────────────────────────────────────────────────────────

export type TreatmentPlanStatus = 'draft' | 'active' | 'under_review' | 'completed' | 'discontinued';
export type GoalStatus = 'not_started' | 'in_progress' | 'achieved' | 'modified' | 'abandoned';

export interface TreatmentPlan {
  id: string;
  patient_id: string;
  therapist_id: string;
  organization_id: string;
  session_id?: string;
  status: TreatmentPlanStatus;
  title: string;
  primary_diagnosis_code?: string;
  presenting_problems: string[];
  treatment_approach: string;
  therapeutic_modalities: string[];
  goals: TreatmentGoal[];
  objectives: TreatmentObjective[];
  interventions: TreatmentIntervention[];
  frequency: string;
  estimated_duration_weeks?: number;
  review_date?: string;
  discharge_criteria?: string;
  patient_strengths?: string;
  barriers_to_treatment?: string;
  support_system?: string;
  crisis_plan?: string;
  patient_agreement: boolean;
  patient_agreement_date?: string;
  supervisor_review_required: boolean;
  supervisor_id?: string;
  supervisor_approved_at?: string;
  version: number;
  previous_version_id?: string;
  ai_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface TreatmentGoal {
  id: string;
  description: string;
  target_date?: string;
  status: GoalStatus;
  progress_notes?: string;
  measurable_outcome?: string;
  baseline?: string;
  created_at: string;
  updated_at: string;
}

export interface TreatmentObjective {
  id: string;
  goal_id: string;
  description: string;
  target_date?: string;
  status: GoalStatus;
  measurement?: string;
  frequency?: string;
}

export interface TreatmentIntervention {
  id: string;
  name: string;
  description?: string;
  evidence_base?: string;
  frequency?: string;
  responsible_party?: string;
}

// ─── AI Systems ───────────────────────────────────────────────────────────────

export type AIAgentType =
  | 'conversation_intelligence'
  | 'knowledge_agent'
  | 'documentation_agent'
  | 'risk_detection'
  | 'memory_agent'
  | 'copilot'
  | 'radar_matching'
  | 'billing_agent'
  | 'workflow_agent';

export type AIModelProvider = 'openai' | 'anthropic' | 'google' | 'azure_openai' | 'custom';

export interface AIAgentConfig {
  agent_type: AIAgentType;
  model: string;
  provider: AIModelProvider;
  temperature: number;
  max_tokens: number;
  system_prompt_version: string;
  enabled: boolean;
  fallback_model?: string;
  rate_limit_rpm?: number;
  cost_per_1k_tokens?: number;
}

export interface CopilotSuggestion {
  id: string;
  session_id: string;
  therapist_id: string;
  patient_id: string;
  suggestion_type: CopilotSuggestionType;
  content: string;
  clinical_rationale?: string;
  evidence_level?: 'high' | 'moderate' | 'low' | 'expert_opinion';
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  dismissed: boolean;
  acted_upon: boolean;
  feedback?: 'helpful' | 'not_helpful' | 'partially_helpful';
  generated_at: string;
  expires_at?: string;
}

export type CopilotSuggestionType =
  | 'intervention_technique'
  | 'question_to_ask'
  | 'topic_to_explore'
  | 'assessment_recommendation'
  | 'risk_flag'
  | 'homework_idea'
  | 'goal_update'
  | 'reframe'
  | 'psychoeducation'
  | 'transition_suggestion';

export interface RiskAlert {
  id: string;
  patient_id: string;
  therapist_id: string;
  session_id?: string;
  organization_id: string;
  alert_type: RiskAlertType;
  severity: RiskLevel;
  indicators: RiskIndicator[];
  ai_confidence: number;
  ai_model_version?: string;
  clinical_summary: string;
  recommended_actions: string[];
  c_ssrs_score?: number;
  is_active: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  action_taken?: string;
  safety_plan_initiated: boolean;
  escalated: boolean;
  escalated_to?: string;
  created_at: string;
  updated_at: string;
}

export type RiskAlertType =
  | 'suicidal_ideation'
  | 'self_harm'
  | 'homicidal_ideation'
  | 'substance_crisis'
  | 'psychotic_episode'
  | 'manic_episode'
  | 'severe_depression'
  | 'trauma_response'
  | 'domestic_violence'
  | 'medication_crisis'
  | 'social_isolation'
  | 'functional_decline';

export interface RiskIndicator {
  type: string;
  detected_phrase?: string;
  context?: string;
  confidence: number;
  source: 'transcript' | 'session_note' | 'assessment' | 'intake' | 'manual';
}

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

export interface SafetyPlan {
  id: string;
  patient_id: string;
  therapist_id: string;
  organization_id: string;
  warning_signs: string[];
  internal_coping_strategies: string[];
  social_contacts: SafetyPlanContact[];
  professional_contacts: SafetyPlanContact[];
  environment_safety: string[];
  reasons_for_living: string[];
  crisis_resources: CrisisResource[];
  patient_signature?: string;
  therapist_signature?: string;
  signed_at?: string;
  reviewed_dates: string[];
  status: 'draft' | 'active' | 'updated' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface SafetyPlanContact {
  name: string;
  relationship?: string;
  phone: string;
  available_hours?: string;
}

export interface CrisisResource {
  name: string;
  type: 'hotline' | 'text_line' | 'chat' | 'emergency';
  contact: string;
  hours?: string;
}

export interface AIUsageMetrics {
  organization_id: string;
  period: string;
  notes_generated: number;
  memories_extracted: number;
  copilot_suggestions_shown: number;
  copilot_suggestions_acted: number;
  risk_alerts_generated: number;
  risk_alerts_accurate: number;
  total_tokens_used: number;
  total_cost_usd: number;
  avg_generation_latency_ms: number;
  user_satisfaction_score?: number;
}

// ─── Radar Matching ───────────────────────────────────────────────────────────

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
  insurance_provider?: string;
  location?: string;
  max_distance_miles?: number;
  telehealth_ok: boolean;
  max_wait_minutes: number;
  status: 'pending' | 'matching' | 'matched' | 'session_scheduled' | 'expired' | 'cancelled';
  match_count: number;
  session_id?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface MatchResult {
  therapist_id: string;
  therapist: Therapist;
  match_score: number;
  match_reasons: string[];
  specialization_match: number;
  availability_match: number;
  language_match: boolean;
  insurance_match: boolean;
  fee_match: boolean;
  next_available_slot?: string;
  estimated_wait_minutes?: number;
  ranking: number;
}

export interface BookingRequest {
  therapist_id: string;
  patient_id?: string;
  session_type: SessionType;
  modality: SessionModality;
  requested_slot: string;
  duration_minutes: number;
  notes?: string;
  insurance_type?: InsuranceType;
  radar_request_id?: string;
  source: 'marketplace' | 'direct' | 'radar' | 'referral' | 'admin';
}

export interface TherapistProfile {
  listing: MarketplaceListing;
  therapist: Therapist;
  reviews: TherapistReview[];
  availability_preview: string[];
  ai_match_score?: number;
  match_reasons?: string[];
}

export interface TherapistReview {
  id: string;
  therapist_id: string;
  reviewer_id: string;
  rating: number;
  comment?: string;
  verified: boolean;
  verified_session: boolean;
  helpful_count: number;
  created_at: string;
}

// ─── Billing ──────────────────────────────────────────────────────────────────

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
  ai_notes_overage_price?: number;
  features: Record<string, boolean | string | number>;
  is_active: boolean;
  is_featured?: boolean;
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
  cancel_at_period_end: boolean;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  organization_id: string;
  patient_id?: string;
  session_id?: string;
  subscription_id?: string;
  invoice_number: string;
  type: 'session' | 'subscription' | 'overage' | 'setup_fee' | 'cancellation';
  status: 'draft' | 'pending' | 'sent' | 'paid' | 'overdue' | 'void' | 'refunded';
  line_items: InvoiceLineItem[];
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  currency: string;
  due_date?: string;
  paid_at?: string;
  payment_method?: string;
  stripe_invoice_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  service_date?: string;
  cpt_code?: string;
  modifier?: string;
}

export interface InsuranceClaim {
  id: string;
  organization_id: string;
  patient_id: string;
  therapist_id: string;
  session_id: string;
  claim_number?: string;
  status: 'pending' | 'submitted' | 'acknowledged' | 'approved' | 'partial' | 'denied' | 'appealed' | 'paid' | 'void';
  payer_name: string;
  payer_id?: string;
  member_id: string;
  group_number?: string;
  primary_diagnosis_code: string;
  secondary_diagnosis_codes?: string[];
  service_date: string;
  cpt_code: string;
  modifier?: string;
  place_of_service: string;
  billed_amount_cents: number;
  allowed_amount_cents?: number;
  paid_amount_cents?: number;
  patient_responsibility_cents?: number;
  denial_reason?: string;
  appeal_deadline?: string;
  submitted_at?: string;
  paid_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  organization_id: string;
  patient_id?: string;
  invoice_id?: string;
  session_id?: string;
  amount_cents: number;
  currency: string;
  payment_method: 'card' | 'ach' | 'check' | 'insurance' | 'cash' | 'other';
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'disputed';
  stripe_payment_intent_id?: string;
  stripe_charge_id?: string;
  refund_amount_cents?: number;
  refunded_at?: string;
  notes?: string;
  created_at: string;
}

// ─── Workflow Engine ──────────────────────────────────────────────────────────

export type WorkflowTriggerType =
  | 'session_completed'
  | 'session_no_show'
  | 'note_generated'
  | 'risk_alert_created'
  | 'risk_alert_critical'
  | 'assessment_completed'
  | 'assessment_score_threshold'
  | 'patient_intake_completed'
  | 'patient_inactive_days'
  | 'treatment_goal_achieved'
  | 'treatment_plan_review_due'
  | 'billing_claim_denied'
  | 'appointment_upcoming'
  | 'appointment_cancelled'
  | 'message_received'
  | 'form_submitted'
  | 'manual_trigger'
  | 'scheduled_time';

export type WorkflowActionType =
  | 'send_notification'
  | 'send_email'
  | 'send_sms'
  | 'create_task'
  | 'schedule_followup'
  | 'generate_note'
  | 'create_assessment'
  | 'update_patient_status'
  | 'update_risk_level'
  | 'assign_to_therapist'
  | 'create_referral'
  | 'generate_report'
  | 'add_to_waitlist'
  | 'webhook_call'
  | 'ai_suggestion';

export interface WorkflowTemplate {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  category: 'clinical' | 'administrative' | 'billing' | 'compliance' | 'patient_engagement' | 'risk';
  trigger: WorkflowTrigger;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  is_active: boolean;
  is_default: boolean;
  priority: number;
  run_count: number;
  last_run_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowTrigger {
  type: WorkflowTriggerType;
  config: Record<string, unknown>;
}

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains' | 'exists' | 'is_empty';
  value: unknown;
  logic?: 'AND' | 'OR';
}

export interface WorkflowAction {
  type: WorkflowActionType;
  config: Record<string, unknown>;
  delay_minutes?: number;
  order: number;
}

export interface WorkflowRun {
  id: string;
  template_id: string;
  organization_id: string;
  trigger_data: Record<string, unknown>;
  patient_id?: string;
  therapist_id?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  actions_completed: number;
  actions_failed: number;
  error_log?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationCategory =
  | 'risk_alert'
  | 'clinical'
  | 'session'
  | 'message'
  | 'ai_insight'
  | 'billing'
  | 'system'
  | 'compliance'
  | 'workflow';

export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low';

export type NotificationDeliveryChannel = 'in_app' | 'email' | 'sms' | 'push';

export interface Notification {
  id: string;
  user_id: string;
  organization_id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  action_label?: string;
  action_href?: string;
  ai_generated?: boolean;
  patient_id?: string;
  session_id?: string;
  channels: NotificationDeliveryChannel[];
  read_at?: string;
  archived_at?: string;
  expires_at?: string;
  created_at: string;
}

export interface NotificationPreferences {
  user_id: string;
  risk_alerts: NotificationChannelPrefs;
  clinical: NotificationChannelPrefs;
  sessions: NotificationChannelPrefs;
  messages: NotificationChannelPrefs;
  ai_insights: NotificationChannelPrefs;
  billing: NotificationChannelPrefs;
  system: NotificationChannelPrefs;
  quiet_hours_enabled: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  digest_enabled: boolean;
  digest_frequency: 'daily' | 'weekly';
  updated_at: string;
}

export interface NotificationChannelPrefs {
  in_app: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;
}

// ─── Referrals ────────────────────────────────────────────────────────────────

export type ReferralStatus = 'draft' | 'sent' | 'received' | 'accepted' | 'declined' | 'completed' | 'expired';
export type ReferralType = 'outgoing' | 'incoming';

export interface Referral {
  id: string;
  organization_id: string;
  referring_therapist_id: string;
  receiving_therapist_id?: string;
  patient_id: string;
  type: ReferralType;
  status: ReferralStatus;
  reason: string;
  clinical_summary?: string;
  urgency: 'routine' | 'urgent' | 'emergency';
  specialty_requested?: string;
  insurance_considerations?: string;
  referring_org_name: string;
  receiving_org_name?: string;
  receiving_provider_name?: string;
  receiving_provider_email?: string;
  response_message?: string;
  responded_at?: string;
  secure_share_token?: string;
  share_expires_at?: string;
  attachments?: ReferralAttachment[];
  created_at: string;
  updated_at: string;
}

export interface ReferralAttachment {
  id: string;
  name: string;
  type: 'clinical_summary' | 'treatment_plan' | 'assessment' | 'session_notes' | 'other';
  url: string;
  size_bytes: number;
  created_at: string;
}

// ─── Analytics & Reporting ────────────────────────────────────────────────────

export interface TherapistAnalytics {
  therapist_id: string;
  organization_id: string;
  period: AnalyticsPeriod;
  total_sessions: number;
  completed_sessions: number;
  no_show_rate: number;
  cancellation_rate: number;
  avg_session_duration_mins: number;
  active_patients: number;
  new_patients: number;
  discharged_patients: number;
  notes_generated: number;
  notes_approved: number;
  avg_note_generation_mins: number;
  ai_time_saved_hours: number;
  revenue_total: number;
  revenue_collected: number;
  collection_rate: number;
  assessments_administered: number;
  treatment_plans_updated: number;
  risk_alerts_generated: number;
  clinical_outcomes: ClinicalOutcomeMetric[];
  generated_at: string;
}

export interface AnalyticsPeriod {
  start: string;
  end: string;
  type: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
}

export interface ClinicalOutcomeMetric {
  assessment_code: string;
  avg_baseline_score: number;
  avg_current_score: number;
  avg_change: number;
  patients_improved_pct: number;
  patients_stable_pct: number;
  patients_worsened_pct: number;
}

export interface PlatformAnalytics {
  organization_id?: string;
  period: AnalyticsPeriod;
  total_therapists: number;
  active_therapists: number;
  total_patients: number;
  active_patients: number;
  total_sessions: number;
  mrr_usd: number;
  arr_usd: number;
  new_signups: number;
  churn_count: number;
  churn_rate: number;
  nps_score?: number;
  ai_notes_generated: number;
  ai_tokens_consumed: number;
  ai_cost_usd: number;
  risk_alerts_generated: number;
  risk_alerts_acted_upon: number;
  generated_at: string;
}

// ─── Marketplace ──────────────────────────────────────────────────────────────

export interface MarketplaceListing {
  id: string;
  therapist_id: string;
  organization_id: string;
  headline?: string;
  description?: string;
  specializations: string[];
  conditions_treated: string[];
  populations_served: string[];
  approaches: string[];
  languages: string[];
  session_fee_min?: number;
  session_fee_max?: number;
  currency: string;
  session_types: string[];
  accepts_insurance: boolean;
  insurance_accepted: string[];
  sliding_scale: boolean;
  telehealth_available: boolean;
  in_person_available: boolean;
  rating?: number;
  review_count: number;
  total_clients_served?: number;
  is_active: boolean;
  is_featured: boolean;
  is_verified: boolean;
  profile_photo_url?: string;
  video_intro_url?: string;
  badges: string[];
  next_available?: string;
  response_time_hours?: number;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceSearchFilters {
  query?: string;
  specializations?: string[];
  approaches?: string[];
  insurance?: string[];
  languages?: string[];
  session_types?: string[];
  fee_max?: number;
  telehealth?: boolean;
  in_person?: boolean;
  accepting_new?: boolean;
  gender?: string;
  location?: string;
  max_distance_miles?: number;
  availability_within_days?: number;
  sort_by?: 'match_score' | 'rating' | 'availability' | 'fee_asc' | 'fee_desc';
}

// ─── Admin & Compliance ───────────────────────────────────────────────────────

export type AuditAction =
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'mfa_setup'
  | 'password_changed'
  | 'session_started'
  | 'session_ended'
  | 'note_generated'
  | 'note_approved'
  | 'note_rejected'
  | 'patient_accessed'
  | 'patient_created'
  | 'patient_updated'
  | 'transcript_accessed'
  | 'export_requested'
  | 'permission_changed'
  | 'settings_changed'
  | 'user_invited'
  | 'user_deactivated';

export interface AuditLog {
  id: string;
  organization_id: string;
  user_id: string;
  user_role: UserRole;
  action: AuditAction;
  resource_type?: string;
  resource_id?: string;
  ip_address?: string;
  user_agent?: string;
  request_id?: string;
  outcome: 'success' | 'failure' | 'warning';
  details?: Record<string, unknown>;
  created_at: string;
}

export interface ComplianceReport {
  id: string;
  organization_id: string;
  type: 'hipaa_access' | 'phi_disclosure' | 'security_incident' | 'baa_review' | 'custom';
  period: AnalyticsPeriod;
  generated_by: string;
  summary: string;
  findings: ComplianceFinding[];
  recommendations: string[];
  status: 'draft' | 'final' | 'submitted' | 'acknowledged';
  generated_at: string;
}

export interface ComplianceFinding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  category: string;
  description: string;
  affected_records?: number;
  recommendation: string;
  resolved?: boolean;
}

export interface DataRetentionPolicy {
  organization_id: string;
  session_recordings_days: number;
  transcripts_days: number;
  ai_notes_days: number;
  audit_logs_days: number;
  inactive_patient_data_days: number;
  backup_retention_days: number;
  auto_delete_enabled: boolean;
  updated_at: string;
}

// ─── Messaging ────────────────────────────────────────────────────────────────

export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed';
export type MessageType = 'text' | 'file' | 'assessment_request' | 'resource_share' | 'appointment_reminder' | 'system';

export interface SecureMessage {
  id: string;
  organization_id: string;
  thread_id: string;
  sender_id: string;
  sender_role: UserRole;
  recipient_id: string;
  patient_id?: string;
  content: string;
  message_type: MessageType;
  attachment?: MessageAttachment;
  status: MessageStatus;
  is_encrypted: boolean;
  hipaa_compliant: boolean;
  ai_risk_flagged: boolean;
  risk_flag_reason?: string;
  delivered_at?: string;
  read_at?: string;
  created_at: string;
}

export interface MessageThread {
  id: string;
  organization_id: string;
  participant_ids: string[];
  patient_id?: string;
  subject?: string;
  last_message?: SecureMessage;
  unread_count: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageAttachment {
  id: string;
  filename: string;
  file_type: string;
  file_size_bytes: number;
  url: string;
  encrypted: boolean;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface TherapistDashboardStats {
  sessions_today: number;
  sessions_this_week: number;
  active_patients: number;
  pending_notes: number;
  revenue_this_month: number;
  radar_requests_pending: number;
  ai_time_saved_hours: number;
  critical_risk_alerts: number;
  assessments_pending: number;
  unread_messages: number;
}

export interface PatientDashboardStats {
  upcoming_sessions: number;
  completed_sessions: number;
  active_goals: number;
  mood_trend: MoodDataPoint[];
  last_assessment_date?: string;
  streaks: { mood_checkins: number; journal_entries: number };
  progress_score?: number;
}

export interface AdminDashboardStats {
  total_organizations: number;
  active_organizations: number;
  total_therapists: number;
  total_patients: number;
  total_sessions_today: number;
  mrr_usd: number;
  churn_rate: number;
  ai_operations_today: number;
  critical_alerts: number;
  platform_health_score: number;
}

// ─── EHR / Integrations ───────────────────────────────────────────────────────

export type EHRSystem = 'epic' | 'cerner' | 'athenahealth' | 'nextgen' | 'allscripts' | 'eclinicalworks' | 'simple_practice' | 'therapy_notes' | 'custom';

export interface EHRIntegration {
  id: string;
  organization_id: string;
  ehr_system: EHRSystem;
  status: 'pending' | 'active' | 'error' | 'disconnected';
  sync_direction: 'read_only' | 'write_only' | 'bidirectional';
  last_sync_at?: string;
  sync_errors?: number;
  data_types_synced: string[];
  fhir_endpoint?: string;
  api_version?: string;
  credentials_stored: boolean;
  created_at: string;
  updated_at: string;
}

export interface FHIRResource {
  resourceType: string;
  id: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
    profile?: string[];
  };
  [key: string]: unknown;
}

// ─── Webhooks & Events ────────────────────────────────────────────────────────

export type PlatformEventType =
  | 'session.started'
  | 'session.completed'
  | 'session.cancelled'
  | 'note.generated'
  | 'note.approved'
  | 'risk.alert.created'
  | 'risk.alert.resolved'
  | 'patient.intake.completed'
  | 'payment.succeeded'
  | 'payment.failed'
  | 'subscription.created'
  | 'subscription.cancelled'
  | 'user.created'
  | 'user.deactivated';

export interface PlatformEvent {
  id: string;
  type: PlatformEventType;
  organization_id: string;
  payload: Record<string, unknown>;
  timestamp: string;
  version: string;
}

export interface WebhookEndpoint {
  id: string;
  organization_id: string;
  url: string;
  events: PlatformEventType[];
  secret: string;
  status: 'active' | 'disabled' | 'failing';
  last_delivery_at?: string;
  failure_count: number;
  created_at: string;
}

// ─── Reporting ────────────────────────────────────────────────────────────────

export type ReportType =
  | 'session_summary'
  | 'treatment_progress'
  | 'clinical_outcomes'
  | 'billing_summary'
  | 'risk_summary'
  | 'patient_demographics'
  | 'therapist_productivity'
  | 'platform_utilization'
  | 'compliance_audit'
  | 'custom';

export interface ReportConfig {
  type: ReportType;
  title?: string;
  period: AnalyticsPeriod;
  filters: Record<string, unknown>;
  format: 'pdf' | 'csv' | 'excel' | 'json';
  include_charts: boolean;
  schedule?: ReportSchedule;
}

export interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  day_of_week?: number;
  day_of_month?: number;
  time: string;
  recipients: string[];
  enabled: boolean;
}

export interface GeneratedReport {
  id: string;
  organization_id: string;
  config: ReportConfig;
  status: 'queued' | 'generating' | 'completed' | 'failed';
  file_url?: string;
  file_size_bytes?: number;
  row_count?: number;
  generated_by: string;
  generated_at?: string;
  expires_at?: string;
  error?: string;
  created_at: string;
}

// ─── Misc / Utility Types ─────────────────────────────────────────────────────

export interface DateRange {
  start: string;
  end: string;
}

export interface GeoLocation {
  lat: number;
  lng: number;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface FileUpload {
  id: string;
  organization_id: string;
  uploader_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  url: string;
  purpose: string;
  encrypted: boolean;
  created_at: string;
  expires_at?: string;
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  query: string;
  filters_applied: Record<string, unknown>;
  search_time_ms: number;
}

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
  disabled?: boolean;
  group?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// ─── White-Label / Enterprise ─────────────────────────────────────────────────

export interface WhiteLabelConfig {
  organization_id: string;
  brand_name: string;
  custom_domain: string;
  logo_url: string;
  favicon_url?: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  email_from_name: string;
  email_from_address: string;
  support_email: string;
  support_url?: string;
  privacy_policy_url?: string;
  terms_of_service_url?: string;
  hide_powered_by: boolean;
  custom_css?: string;
  custom_login_message?: string;
  updated_at: string;
}

export interface EnterpriseFeatureFlags {
  organization_id: string;
  sso_saml: boolean;
  sso_oidc: boolean;
  advanced_audit_logs: boolean;
  custom_roles: boolean;
  api_access: boolean;
  webhook_access: boolean;
  ehr_integrations: boolean;
  bulk_operations: boolean;
  dedicated_support: boolean;
  sla_guarantee: boolean;
  custom_data_retention: boolean;
  dedicated_instance: boolean;
  updated_at: string;
}

// ─── Patient Mood & Journal ───────────────────────────────────────────────────

export type MoodLabel = 'very_low' | 'low' | 'neutral' | 'good' | 'great';
export type EmotionTag = 'anxious' | 'sad' | 'angry' | 'hopeful' | 'calm' | 'energized' | 'overwhelmed' | 'grateful' | 'lonely' | 'connected';

export interface MoodEntry {
  id: string;
  patient_id: string;
  score: number; // 1-10
  label: MoodLabel;
  emotion_tags: EmotionTag[];
  energy_level?: number; // 1-10
  sleep_hours?: number;
  notes?: string;
  session_id?: string;
  recorded_at: string;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  patient_id: string;
  title?: string;
  content: string;
  mood?: number;
  emotion_tags?: EmotionTag[];
  is_private: boolean;
  shared_with_therapist: boolean;
  prompt_used?: string;
  word_count: number;
  ai_insights?: string;
  created_at: string;
  updated_at: string;
}

export interface HomeworkAssignment {
  id: string;
  patient_id: string;
  therapist_id: string;
  session_id?: string;
  title: string;
  description: string;
  type: 'reading' | 'exercise' | 'journaling' | 'mindfulness' | 'behavioral_activation' | 'exposure' | 'worksheet' | 'other';
  due_date?: string;
  resource_url?: string;
  status: 'assigned' | 'in_progress' | 'completed' | 'skipped';
  completion_notes?: string;
  therapist_feedback?: string;
  assigned_at: string;
  completed_at?: string;
}

// ─── CRM (Sales / Admin) ──────────────────────────────────────────────────────

export type LeadStage = 'prospect' | 'contacted' | 'demo_scheduled' | 'negotiating' | 'closed_won' | 'closed_lost';
export type LeadType = 'solo_therapist' | 'group_practice' | 'enterprise' | 'health_system';

export interface CRMLead {
  id: string;
  name: string;
  organization: string;
  type: LeadType;
  stage: LeadStage;
  owner: string;
  email: string;
  phone?: string;
  therapist_count: number;
  deal_value: number;
  source: string;
  last_contact: string;
  next_action: string;
  next_action_date: string;
  score: number;
  notes?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

// ─── Group Sessions ───────────────────────────────────────────────────────────

export interface GroupSession {
  id: string;
  organization_id: string;
  therapist_id: string;
  title: string;
  description?: string;
  group_type: 'therapy' | 'psychoeducation' | 'support' | 'skills_training' | 'process';
  max_participants: number;
  current_participants: number;
  participants: GroupParticipant[];
  scheduled_at?: string;
  duration_minutes: number;
  status: SessionStatus;
  video_room_url?: string;
  recurring: boolean;
  recurrence_pattern?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface GroupParticipant {
  patient_id: string;
  joined_at: string;
  status: 'active' | 'waitlist' | 'completed' | 'dropped';
  attendance_count: number;
  last_attended?: string;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

// Re-export all types grouped by domain for convenience
export type {
  // The actual types are declared above, this section documents domain groupings:
  // CORE: User, UserRole, UserStatus, Organization, OrganizationSettings
  // THERAPIST: Therapist, TherapistAIPreferences, TherapistAvailability
  // PATIENT: Patient, PatientConsent, PatientMedication, PatientDiagnosis
  // SESSION: Session, SessionPrep, AISessionBrief
  // NOTES: AISessionNote, SOAPNote, DAPNote, BIRPNote
  // MEMORY: MemoryNode, KnowledgeGraph, LongitudinalIntelligence, AIContext
  // ASSESSMENT: AssessmentTemplate, AssessmentResult
  // TREATMENT: TreatmentPlan, TreatmentGoal
  // AI: CopilotSuggestion, RiskAlert, SafetyPlan, AIUsageMetrics
  // RADAR: RadarRequest, MatchResult, BookingRequest
  // BILLING: Invoice, InsuranceClaim, Payment, Subscription
  // WORKFLOW: WorkflowTemplate, WorkflowRun
  // ANALYTICS: TherapistAnalytics, PlatformAnalytics
  // COMPLIANCE: AuditLog, ComplianceReport
  // INTEGRATIONS: EHRIntegration, FHIRResource, WebhookEndpoint
};

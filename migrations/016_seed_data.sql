-- ============================================================
-- 016_seed_data.sql
-- 24Therapy — All default / seed data
-- Every INSERT uses ON CONFLICT DO NOTHING (or DO UPDATE where
-- noted) so this file is fully idempotent.
-- ============================================================

-- ============================================================
-- SECTION 1: Legacy plans (used by organizations.plan_id)
-- ============================================================
INSERT INTO plans (name, code, description, price_monthly, price_yearly,
                   max_therapists, max_patients, max_sessions_per_month, features, is_active)
VALUES
  ('Starter',     'starter',      'Perfect for solo practitioners',                            59,   590,  1,    100,  80,   '{"ai_notes":true,"radar":false}',                                                 true),
  ('Professional','professional', 'Full platform for growing practices',                        99,   990,  5,    500,  400,  '{"ai_notes":true,"radar":true,"analytics":true}',                                 true),
  ('Practice',    'practice',     'Multi-therapist team plans',                                299,  2990, 25,   2500, 2000, '{"ai_notes":true,"radar":true,"analytics":true,"white_label":true}',               true),
  ('Enterprise',  'enterprise',   'Hospitals, universities, healthcare systems',                NULL, NULL, NULL, NULL, NULL, '{"ai_notes":true,"radar":true,"analytics":true,"white_label":true,"sso":true,"ehr":true}', true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- SECTION 2: subscription_plans (billing engine)
-- ============================================================
INSERT INTO subscription_plans (
  plan_key, name, tagline, monthly_price_usd, annual_price_usd,
  price_per_session_usd, max_sessions_month, ai_notes_included,
  is_active, is_featured, badge_text, cta_text, trial_days,
  color_scheme, audience, display_order, feature_bullets
)
VALUES
  (
    'pay_per_session',
    'Pay Per Session',
    'First session free, then $6 per session',
    0, 0, 6.00, NULL, NULL,
    true, false, NULL, 'Start free', 0,
    'slate', 'therapist', 0,
    '["First session completely free","$6 per completed session","No monthly commitment","All AI features included"]'::JSONB
  ),
  (
    'starter',
    'Starter',
    '20 sessions/mo — 50% off pay-as-you-go',
    59, 590, NULL, 20, 20,
    true, false, NULL, 'Start Starter', 0,
    'blue', 'therapist', 1,
    '["20 sessions/month included","≈$3 per session (50% off PAYG)","Unused sessions roll over (up to 20 banked)","Full AI scribe & copilot","HIPAA BAA included"]'::JSONB
  ),
  (
    'pro',
    'Unlimited',
    'Unlimited sessions — full platform power',
    99, 990, NULL, NULL, NULL,
    true, true, 'Most Popular', 'Start Unlimited', 0,
    'purple', 'therapist', 2,
    '["Unlimited sessions","Unlimited AI notes (SOAP/DAP/BIRP)","Session transcription","Emotional AI & crisis detection","Priority AI processing","HIPAA BAA included","Advanced analytics"]'::JSONB
  ),
  (
    'practice',
    'Practice',
    'from $189/mo for 2 therapists',
    189, 1890, NULL, NULL, NULL,
    true, false, 'Teams', 'Start with your team', 0,
    'teal', 'therapist', 3,
    '["2 therapist seats included","Additional seats: $85/mo each","Shared patient management","Team analytics dashboard","Admin portal","HIPAA BAA included"]'::JSONB
  ),
  (
    'enterprise',
    'Enterprise',
    'Hospitals, universities, healthcare systems',
    0, 0, NULL, NULL, NULL,
    true, false, NULL, 'Contact Sales', 0,
    'slate', 'therapist', 4,
    '["Unlimited therapists & patients","Custom AI models","White-label branding","SSO / SAML","EHR integration","Dedicated support","HIPAA BAA included","Custom SLA"]'::JSONB
  )
ON CONFLICT (plan_key) DO UPDATE
  SET name              = EXCLUDED.name,
      tagline           = EXCLUDED.tagline,
      monthly_price_usd = EXCLUDED.monthly_price_usd,
      annual_price_usd  = EXCLUDED.annual_price_usd,
      is_active         = EXCLUDED.is_active,
      updated_at        = NOW();

-- ============================================================
-- SECTION 3: specialization_taxonomy (25 entries)
-- ============================================================
INSERT INTO specialization_taxonomy (code, name, category, sort_order)
VALUES
  ('anxiety',          'Anxiety',                        'mood',         1),
  ('depression',       'Depression',                     'mood',         2),
  ('adhd',             'ADHD',                           'developmental',3),
  ('trauma',           'Trauma',                         'trauma',       4),
  ('ptsd',             'PTSD',                           'trauma',       5),
  ('ocd',              'OCD',                            'anxiety',      6),
  ('grief',            'Grief & Loss',                   'life_events',  7),
  ('addiction',        'Addiction & Substance Use',      'behavioral',   8),
  ('relationships',    'Relationship Issues',            'relational',   9),
  ('couples',          'Couples Therapy',                'relational',   10),
  ('family',           'Family Therapy',                 'relational',   11),
  ('eating_disorders', 'Eating Disorders',               'behavioral',   12),
  ('burnout',          'Burnout & Work Stress',          'life_events',  13),
  ('sleep',            'Sleep Disorders',                'behavioral',   14),
  ('self_esteem',      'Self-Esteem & Confidence',       'mood',         15),
  ('parenting',        'Parenting',                      'life_events',  16),
  ('career',           'Career & Life Transitions',      'life_events',  17),
  ('student',          'Student & Academic Stress',      'life_events',  18),
  ('lgbtq',            'LGBTQ+ Issues',                  'identity',     19),
  ('cultural',         'Cultural & Identity Issues',     'identity',     20),
  ('chronic_illness',  'Chronic Illness & Pain',         'health',       21),
  ('bipolar',          'Bipolar Disorder',               'mood',         22),
  ('psychosis',        'Psychosis & Schizophrenia',      'psychosis',    23),
  ('anger',            'Anger Management',               'behavioral',   24),
  ('phobias',          'Phobias & Specific Fears',       'anxiety',      25)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- SECTION 4: medications (24 psychiatric medications)
-- ============================================================
INSERT INTO medications (name, brand_name, drug_class, is_controlled, notes)
VALUES
  ('Fluoxetine',          'Prozac',      'SSRI',                      false, 'First-line for depression and anxiety'),
  ('Sertraline',          'Zoloft',      'SSRI',                      false, 'First-line for depression, OCD, PTSD'),
  ('Escitalopram',        'Lexapro',     'SSRI',                      false, 'Well-tolerated SSRI for depression and GAD'),
  ('Venlafaxine',         'Effexor',     'SNRI',                      false, 'Depression and anxiety; dose-dependent NE effects'),
  ('Duloxetine',          'Cymbalta',    'SNRI',                      false, 'Depression, GAD, and chronic pain'),
  ('Bupropion',           'Wellbutrin',  'NDRI',                      false, 'Depression and smoking cessation; activating'),
  ('Alprazolam',          'Xanax',       'Benzodiazepine',            true,  'Short-term anxiety; high abuse potential'),
  ('Lorazepam',           'Ativan',      'Benzodiazepine',            true,  'Acute anxiety and insomnia; short half-life'),
  ('Clonazepam',          'Klonopin',    'Benzodiazepine',            true,  'Panic disorder and seizure; longer half-life'),
  ('Aripiprazole',        'Abilify',     'Atypical Antipsychotic',    false, 'Adjunct for depression; bipolar; schizophrenia'),
  ('Quetiapine',          'Seroquel',    'Atypical Antipsychotic',    false, 'Bipolar, schizophrenia, insomnia off-label'),
  ('Risperidone',         'Risperdal',   'Atypical Antipsychotic',    false, 'Schizophrenia; bipolar; irritability in autism'),
  ('Lithium Carbonate',   'Lithobid',    'Mood Stabilizer',           false, 'Gold standard for bipolar; narrow therapeutic index'),
  ('Lamotrigine',         'Lamictal',    'Mood Stabilizer',           false, 'Bipolar depression maintenance; epilepsy'),
  ('Valproate',           'Depakote',    'Mood Stabilizer',           false, 'Bipolar mania; epilepsy; migraine prophylaxis'),
  ('Amphetamine Salts',   'Adderall',    'Stimulant',                 true,  'ADHD and narcolepsy; schedule II'),
  ('Methylphenidate',     'Ritalin',     'Stimulant',                 true,  'ADHD; schedule II; multiple formulations'),
  ('Atomoxetine',         'Strattera',   'SNRI for ADHD',             false, 'Non-stimulant ADHD treatment'),
  ('Zolpidem',            'Ambien',      'Sleep Aid',                 true,  'Short-term insomnia; schedule IV'),
  ('Trazodone',           'Desyrel',     'Atypical Antidepressant',   false, 'Insomnia and depression; sedating'),
  ('Buspirone',           'Buspar',      'Anxiolytic',                false, 'GAD; non-habit-forming; slow onset'),
  ('Mirtazapine',         'Remeron',     'Atypical Antidepressant',   false, 'Depression with insomnia or appetite loss'),
  ('Clomipramine',        'Anafranil',   'TCA',                       false, 'OCD gold standard; also depression'),
  ('Hydroxyzine',         'Vistaril',    'Antihistamine/Anxiolytic',  false, 'Acute anxiety; non-addictive; also pruritus')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 5: assessment_templates (7 standard assessments)
-- ============================================================
INSERT INTO assessment_templates (
  type_key, name, category, description, max_score, interpretation_guide,
  instructions, is_active, version
)
VALUES
  (
    'PHQ-9',
    'Patient Health Questionnaire-9',
    'depression',
    'Validated 9-item screening tool for depression severity.',
    27,
    '{"0-4":"Minimal depression","5-9":"Mild depression","10-14":"Moderate depression","15-19":"Moderately severe depression","20-27":"Severe depression"}'::JSONB,
    'Over the last 2 weeks, how often have you been bothered by any of the following problems?',
    true,
    '1.0'
  ),
  (
    'GAD-7',
    'Generalized Anxiety Disorder 7',
    'anxiety',
    'Validated 7-item screening tool for generalized anxiety disorder.',
    21,
    '{"0-4":"Minimal anxiety","5-9":"Mild anxiety","10-14":"Moderate anxiety","15-21":"Severe anxiety"}'::JSONB,
    'Over the last 2 weeks, how often have you been bothered by any of the following problems?',
    true,
    '1.0'
  ),
  (
    'PCL-5',
    'PTSD Checklist for DSM-5',
    'trauma',
    '20-item self-report measure of PTSD symptoms per DSM-5 criteria.',
    80,
    '{"0-32":"Below clinical threshold","33-80":"Probable PTSD — further evaluation warranted"}'::JSONB,
    'Below is a list of problems that people sometimes have in response to a very stressful experience. Rate how much you have been bothered in the past month.',
    true,
    '1.0'
  ),
  (
    'AUDIT',
    'Alcohol Use Disorders Identification Test',
    'substance',
    '10-item WHO screening tool for hazardous and harmful alcohol consumption.',
    40,
    '{"0-7":"Lower risk","8-15":"Increasing risk","16-19":"Higher risk","20-40":"Possible dependence"}'::JSONB,
    'The following questions are about your use of alcoholic beverages during this past year.',
    true,
    '1.0'
  ),
  (
    'DAST-10',
    'Drug Abuse Screening Test',
    'substance',
    '10-item self-report screening tool for drug misuse.',
    10,
    '{"0":"No problems","1-2":"Low level","3-5":"Moderate level","6-8":"Substantial level","9-10":"Severe level"}'::JSONB,
    'The following questions concern information about your potential involvement with drugs. Drug use includes all non-medical use of any drug.',
    true,
    '1.0'
  ),
  (
    'ASRS-v1.1',
    'Adult ADHD Self-Report Scale v1.1',
    'adhd',
    '18-item screening scale for adult ADHD developed in conjunction with the WHO.',
    18,
    '{"0-3":"ADHD unlikely","4-18":"May have ADHD — clinical evaluation recommended"}'::JSONB,
    'Please answer the questions below, rating yourself on each of the criteria shown using the scale on the right side of the page.',
    true,
    '1.0'
  ),
  (
    'WHO-5',
    'World Health Organization Wellbeing Index',
    'wellbeing',
    '5-item measure of current mental wellbeing used as an outcome measure and depression screener.',
    25,
    '{"0-12":"Poor wellbeing — screen for depression","13-25":"Adequate wellbeing"}'::JSONB,
    'Please indicate for each of the five statements which is closest to how you have been feeling over the last two weeks.',
    true,
    '1.0'
  )
ON CONFLICT (type_key) DO NOTHING;

-- ============================================================
-- SECTION 6: assessment_questions (PHQ-9 and GAD-7)
-- ============================================================

-- PHQ-9 questions (9 items, scale 0–3)
WITH tmpl AS (SELECT id FROM assessment_templates WHERE type_key = 'PHQ-9' LIMIT 1)
INSERT INTO assessment_questions
  (template_id, question_order, question_text, question_type, options, min_score, max_score)
SELECT
  tmpl.id,
  q.ord,
  q.txt,
  'likert',
  '[{"value":0,"label":"Not at all"},{"value":1,"label":"Several days"},{"value":2,"label":"More than half the days"},{"value":3,"label":"Nearly every day"}]'::JSONB,
  0,
  3
FROM tmpl,
(VALUES
  (1, 'Little interest or pleasure in doing things'),
  (2, 'Feeling down, depressed, or hopeless'),
  (3, 'Trouble falling or staying asleep, or sleeping too much'),
  (4, 'Feeling tired or having little energy'),
  (5, 'Poor appetite or overeating'),
  (6, 'Feeling bad about yourself — or that you are a failure or have let yourself or your family down'),
  (7, 'Trouble concentrating on things, such as reading the newspaper or watching television'),
  (8, 'Moving or speaking so slowly that other people could have noticed? Or so fidgety or restless that you have been moving around a lot more than usual'),
  (9, 'Thoughts that you would be better off dead, or thoughts of hurting yourself in some way')
) AS q(ord, txt)
ON CONFLICT DO NOTHING;

-- GAD-7 questions (7 items, scale 0–3)
WITH tmpl AS (SELECT id FROM assessment_templates WHERE type_key = 'GAD-7' LIMIT 1)
INSERT INTO assessment_questions
  (template_id, question_order, question_text, question_type, options, min_score, max_score)
SELECT
  tmpl.id,
  q.ord,
  q.txt,
  'likert',
  '[{"value":0,"label":"Not at all"},{"value":1,"label":"Several days"},{"value":2,"label":"More than half the days"},{"value":3,"label":"Nearly every day"}]'::JSONB,
  0,
  3
FROM tmpl,
(VALUES
  (1, 'Feeling nervous, anxious, or on edge'),
  (2, 'Not being able to stop or control worrying'),
  (3, 'Worrying too much about different things'),
  (4, 'Trouble relaxing'),
  (5, 'Being so restless that it is hard to sit still'),
  (6, 'Becoming easily annoyed or irritable'),
  (7, 'Feeling afraid as if something awful might happen')
) AS q(ord, txt)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 7: ai_model_registry (5 models)
-- ============================================================
INSERT INTO ai_model_registry
  (provider, model_id, model_type, display_name, cost_per_1k_input, cost_per_1k_output,
   context_window, is_default, is_active, use_cases)
VALUES
  ('openai',     'gpt-4o',                  'chat',          'GPT-4o',                  2.50,  10.00, 128000, true,  true, '{scribe,copilot,crisis,memory}'),
  ('openai',     'gpt-4o-mini',             'chat',          'GPT-4o Mini',             0.15,  0.60,  128000, false, true, '{emotional_analysis,companion}'),
  ('anthropic',  'claude-sonnet-4-6',       'chat',          'Claude Sonnet 4.6',       3.00,  15.00, 200000, false, true, '{analysis,research}'),
  ('openai',     'text-embedding-3-small',  'embedding',     'Text Embedding 3 Small',  0.02,  0,     8192,   true,  true, '{memory,search}'),
  ('openai',     'whisper-1',               'transcription', 'Whisper v1',              0.006, 0,     NULL,   true,  true, '{transcription}')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 8: prompt_registry (5 standard prompts)
-- ============================================================
INSERT INTO prompt_registry (name, version, full_key, description, template, status)
VALUES
  (
    'SOAP_NOTE', 'v1', 'SOAP_NOTE_V1',
    'Generate structured SOAP clinical note from session transcript',
    'You are an expert clinical documentation assistant. Given the session transcript below, generate a structured SOAP note.\n\nFormat:\nS (Subjective): Patient-reported concerns, symptoms, and experiences.\nO (Objective): Observable behaviors and clinician observations.\nA (Assessment): Clinical formulation and diagnostic impressions.\nP (Plan): Treatment plan, interventions, and next steps.\n\nTranscript:\n{{transcript}}',
    'active'
  ),
  (
    'SESSION_SUMMARY', 'v1', 'SESSION_SUMMARY_V1',
    'Generate concise session summary',
    'You are a clinical documentation assistant. Write a concise 3–5 sentence summary of this therapy session highlighting key themes, patient mood, and progress.\n\nTranscript:\n{{transcript}}',
    'active'
  ),
  (
    'MEMORY_EXTRACTION', 'v1', 'MEMORY_EXTRACTION_V1',
    'Extract clinical memory items from session',
    'You are a clinical assistant extracting important information from a therapy session to remember for future sessions. Extract key facts about the patient as a JSON array of objects with fields: type, content, importance (1-10).\n\nTypes: personal_background, relationship, health, goal, preference, event, trigger, strength.\n\nTranscript:\n{{transcript}}',
    'active'
  ),
  (
    'RISK_ASSESSMENT', 'v1', 'RISK_ASSESSMENT_V1',
    'Assess clinical risk from transcript',
    'You are a clinical safety assessment specialist. Analyze the following therapy session transcript for any indicators of risk to the patient or others. Return a JSON object with: risk_level (none/low/medium/high/critical), indicators (string[]), recommended_actions (string[]), requires_immediate_action (boolean).\n\nTranscript:\n{{transcript}}',
    'active'
  ),
  (
    'COPILOT_SUGGESTIONS', 'v1', 'COPILOT_SUGGESTIONS_V1',
    'Real-time therapist copilot suggestions',
    'You are an AI clinical copilot supporting a therapist in real time. Based on the recent session transcript segment, provide 2–3 brief, actionable suggestions the therapist might consider. Be concise and clinically grounded.\n\nRecent transcript:\n{{transcript_segment}}',
    'active'
  )
ON CONFLICT (full_key) DO NOTHING;

-- ============================================================
-- SECTION 9: marketplace_categories (18 categories)
-- ============================================================
INSERT INTO marketplace_categories (type, key, display_name, display_order, is_featured)
VALUES
  -- Specialties
  ('specialty', 'anxiety',          'Anxiety',             1,  true),
  ('specialty', 'depression',       'Depression',          2,  true),
  ('specialty', 'trauma',           'Trauma & PTSD',       3,  true),
  ('specialty', 'relationships',    'Relationships',       4,  true),
  ('specialty', 'adhd',             'ADHD',                5,  false),
  ('specialty', 'grief',            'Grief & Loss',        6,  false),
  ('specialty', 'ocd',              'OCD',                 7,  false),
  ('specialty', 'addiction',        'Addiction',           8,  false),
  ('specialty', 'burnout',          'Burnout',             9,  false),
  ('specialty', 'eating_disorders', 'Eating Disorders',    10, false),
  -- Approaches
  ('approach',  'cbt',              'CBT',                 1,  true),
  ('approach',  'dbt',              'DBT',                 2,  false),
  ('approach',  'emdr',             'EMDR',                3,  true),
  ('approach',  'mindfulness',      'Mindfulness',         4,  false),
  -- Audience
  ('audience',  'adults',           'Adults',              1,  true),
  ('audience',  'adolescents',      'Adolescents',         2,  true),
  ('audience',  'couples',          'Couples',             3,  true),
  ('audience',  'families',         'Families',            4,  false)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- SECTION 10: feature_flags (8 flags)
-- ============================================================
INSERT INTO feature_flags (key, name, description, enabled, rollout_pct, tags, category)
VALUES
  ('ai_copilot_v2',          'AI Copilot v2',          'Enhanced real-time copilot with streaming suggestions', false, 0, '{ai}',          'ai'),
  ('ai_memory_enhanced',     'Enhanced Memory',         'Vector search memory retrieval via pgvector',           false, 0, '{ai}',          'ai'),
  ('crisis_auto_escalation', 'Crisis Auto-Escalation',  'Automatically escalate high-risk alerts to admin',     false, 0, '{safety}',      'safety'),
  ('video_recording',        'Session Recording',       'Record session video and store securely',               false, 0, '{sessions}',    'sessions'),
  ('group_therapy',          'Group Therapy',           'Support multi-patient group sessions',                  false, 0, '{sessions}',    'sessions'),
  ('marketplace_v2',         'Marketplace v2',          'Redesigned marketplace experience with new search',     false, 0, '{marketplace}', 'marketplace'),
  ('patient_app',            'Patient Mobile App',      'Native iOS/Android mobile app for patients',           false, 0, '{platform}',    'platform'),
  ('telehealth_rooms',       'Telehealth Rooms',        'Built-in video rooms (alternative to Daily.co)',        false, 0, '{platform}',    'platform')
ON CONFLICT (key) DO UPDATE
  SET name        = EXCLUDED.name,
      description = EXCLUDED.description,
      updated_at  = NOW();

-- ============================================================
-- SECTION 11: consent_versions (6 consent types)
-- ============================================================
INSERT INTO consent_versions (consent_type, version, title, content, summary, effective_date, is_required, language)
VALUES
  (
    'privacy_policy', '1.0', 'Privacy Policy',
    'This Privacy Policy describes how 24Therapy ("we", "our", "us") collects, uses, and protects your personal information and protected health information (PHI) in compliance with HIPAA and applicable privacy laws.',
    'Explains how 24Therapy collects, uses, and protects your health information.',
    '2024-01-01', true, 'en'
  ),
  (
    'terms_of_service', '1.0', 'Terms of Service',
    'By accessing or using the 24Therapy platform, you agree to be bound by these Terms of Service. The platform is intended for licensed mental health professionals and their patients in a clinical capacity.',
    'Rules governing your use of the 24Therapy platform.',
    '2024-01-01', true, 'en'
  ),
  (
    'recording_consent', '1.0', 'Session Recording Consent',
    'This consent authorizes 24Therapy to record your therapy session audio and/or video for the purposes of AI-assisted note generation. Recordings are encrypted, stored securely, and retained in accordance with HIPAA regulations.',
    'Consent for recording your therapy sessions for AI note generation.',
    '2024-01-01', false, 'en'
  ),
  (
    'telehealth_consent', '1.0', 'Telehealth Informed Consent',
    'This consent acknowledges that you understand the nature of telehealth services, including potential risks (technology failures, privacy limitations) and your right to in-person care. You consent to receive mental health services via the 24Therapy platform.',
    'Informed consent for receiving mental health services via telehealth.',
    '2024-01-01', true, 'en'
  ),
  (
    'ai_assistance_consent', '1.0', 'AI Assistance Consent',
    'This consent acknowledges your understanding that 24Therapy uses artificial intelligence to assist with clinical documentation (note generation, session summaries), emotional analysis, and crisis detection. AI outputs are reviewed by your licensed therapist before use.',
    'Consent for AI-assisted clinical documentation and analysis.',
    '2024-01-01', true, 'en'
  ),
  (
    'data_processing_consent', '1.0', 'Data Processing Agreement',
    'This agreement describes how your protected health information (PHI) is processed by 24Therapy and its HIPAA-compliant business associates (Business Associate Agreements in place with all subprocessors). Your data is never sold or used for advertising.',
    'Agreement covering how your health data is processed and protected.',
    '2024-01-01', true, 'en'
  )
ON CONFLICT (consent_type, version, language) DO NOTHING;

-- ============================================================
-- SECTION 12: notification_templates (12 templates)
-- ============================================================
INSERT INTO notification_templates (template_key, name, channel, subject, body_text, variables, is_active)
VALUES
  (
    'session_reminder_24h', 'Session Reminder — 24 Hours', 'email',
    'Reminder: Your therapy session is tomorrow at {{session_time}}',
    'Hi {{patient_name}},\n\nThis is a reminder that you have a therapy session with {{therapist_name}} scheduled for tomorrow, {{session_date}} at {{session_time}}.\n\nJoin here: {{session_url}}\n\nIf you need to reschedule, please contact your therapist at least 24 hours in advance.\n\n— 24Therapy',
    '{patient_name,therapist_name,session_date,session_time,session_url}',
    true
  ),
  (
    'session_reminder_1h', 'Session Reminder — 1 Hour', 'push',
    'Your session starts in 1 hour',
    'Hi {{patient_name}}, your therapy session with {{therapist_name}} starts in 1 hour. Tap to join.',
    '{patient_name,therapist_name}',
    true
  ),
  (
    'session_cancelled', 'Session Cancelled', 'email',
    'Your session on {{session_date}} has been cancelled',
    'Hi {{recipient_name}},\n\nYour therapy session scheduled for {{session_date}} at {{session_time}} has been cancelled.\n\nReason: {{cancel_reason}}\n\nPlease contact your therapist to reschedule.\n\n— 24Therapy',
    '{recipient_name,session_date,session_time,cancel_reason}',
    true
  ),
  (
    'session_completed', 'Session Completed', 'in_app',
    'Session complete',
    'Your session with {{therapist_name}} on {{session_date}} has been completed. Your session notes will be available shortly.',
    '{therapist_name,session_date}',
    true
  ),
  (
    'new_message', 'New Message', 'push',
    'New message from {{sender_name}}',
    'You have a new message from {{sender_name}}: {{message_preview}}',
    '{sender_name,message_preview}',
    true
  ),
  (
    'assessment_due', 'Assessment Due', 'email',
    'Assessment reminder: {{assessment_name}} is due',
    'Hi {{patient_name}},\n\nYour therapist has requested that you complete the {{assessment_name}} assessment. Please complete it before your next session on {{next_session_date}}.\n\nComplete here: {{assessment_url}}\n\n— 24Therapy',
    '{patient_name,assessment_name,next_session_date,assessment_url}',
    true
  ),
  (
    'report_ready', 'Report Ready', 'in_app',
    'Your session report is ready',
    'Your session report from {{session_date}} is ready for review. Click to view.',
    '{session_date}',
    true
  ),
  (
    'radar_match', 'Radar Match Available', 'push',
    'A patient needs support now',
    '{{urgency_label}} patient match available. Presenting: {{presenting_issue}}. Tap to respond within {{wait_minutes}} minutes.',
    '{urgency_label,presenting_issue,wait_minutes}',
    true
  ),
  (
    'risk_alert_therapist', 'Risk Alert — Therapist', 'in_app',
    'Risk alert for {{patient_name}}',
    'A risk indicator was detected during your session with {{patient_name}}. Please review and take appropriate action. Risk level: {{risk_level}}.',
    '{patient_name,risk_level}',
    true
  ),
  (
    'payment_received', 'Payment Received', 'email',
    'Payment confirmed — Invoice #{{invoice_number}}',
    'Hi {{org_name}},\n\nWe have received your payment of {{amount}} for Invoice #{{invoice_number}}. Thank you!\n\nView your invoice: {{invoice_url}}\n\n— 24Therapy Billing',
    '{org_name,amount,invoice_number,invoice_url}',
    true
  ),
  (
    'welcome_therapist', 'Welcome — Therapist', 'email',
    'Welcome to 24Therapy, {{therapist_name}}!',
    'Hi {{therapist_name}},\n\nWelcome to 24Therapy! Your account is ready. Here is how to get started:\n\n1. Complete your marketplace profile\n2. Set your availability\n3. Invite your first patient\n\nGet started: {{portal_url}}\n\nIf you have any questions, reply to this email.\n\n— The 24Therapy Team',
    '{therapist_name,portal_url}',
    true
  ),
  (
    'welcome_patient', 'Welcome — Patient', 'email',
    'Welcome to 24Therapy — you are all set',
    'Hi {{patient_name}},\n\nYour 24Therapy account is ready. Your first session with {{therapist_name}} is scheduled for {{first_session_date}}.\n\nAccess your portal: {{portal_url}}\n\nWe are glad you are here.\n\n— The 24Therapy Team',
    '{patient_name,therapist_name,first_session_date,portal_url}',
    true
  )
ON CONFLICT (template_key) DO NOTHING;

-- ============================================================
-- 24Therapy MVP seed data — plans, taxonomy, prompts, templates
-- Idempotent (ON CONFLICT guards). The default organization and
-- super-admin user are seeded by scripts/seed.js (SEED_* env vars).
-- ============================================================

-- ─── subscription_plans ───
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

-- ─── specialization_taxonomy ───
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

-- ─── medications ───
INSERT INTO medications (name, generic_name, drug_class, controlled_substance, description)
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

-- ─── assessment_templates ───
INSERT INTO assessment_templates (
  type_key, name, category, description, max_score, interpretation_guide, is_active
)
VALUES
  (
    'PHQ-9',
    'Patient Health Questionnaire-9',
    'depression',
    'Validated 9-item screening tool for depression severity.',
    27,
    '{"0-4":"Minimal depression","5-9":"Mild depression","10-14":"Moderate depression","15-19":"Moderately severe depression","20-27":"Severe depression"}'::JSONB,
    true
  ),
  (
    'GAD-7',
    'Generalized Anxiety Disorder 7',
    'anxiety',
    'Validated 7-item screening tool for generalized anxiety disorder.',
    21,
    '{"0-4":"Minimal anxiety","5-9":"Mild anxiety","10-14":"Moderate anxiety","15-21":"Severe anxiety"}'::JSONB,
    true
  ),
  (
    'PCL-5',
    'PTSD Checklist for DSM-5',
    'trauma',
    '20-item self-report measure of PTSD symptoms per DSM-5 criteria.',
    80,
    '{"0-32":"Below clinical threshold","33-80":"Probable PTSD — further evaluation warranted"}'::JSONB,
    true
  ),
  (
    'AUDIT',
    'Alcohol Use Disorders Identification Test',
    'substance',
    '10-item WHO screening tool for hazardous and harmful alcohol consumption.',
    40,
    '{"0-7":"Lower risk","8-15":"Increasing risk","16-19":"Higher risk","20-40":"Possible dependence"}'::JSONB,
    true
  ),
  (
    'DAST-10',
    'Drug Abuse Screening Test',
    'substance',
    '10-item self-report screening tool for drug misuse.',
    10,
    '{"0":"No problems","1-2":"Low level","3-5":"Moderate level","6-8":"Substantial level","9-10":"Severe level"}'::JSONB,
    true
  ),
  (
    'ASRS-v1.1',
    'Adult ADHD Self-Report Scale v1.1',
    'adhd',
    '18-item screening scale for adult ADHD developed in conjunction with the WHO.',
    18,
    '{"0-3":"ADHD unlikely","4-18":"May have ADHD — clinical evaluation recommended"}'::JSONB,
    true
  ),
  (
    'WHO-5',
    'World Health Organization Wellbeing Index',
    'wellbeing',
    '5-item measure of current mental wellbeing used as an outcome measure and depression screener.',
    25,
    '{"0-12":"Poor wellbeing — screen for depression","13-25":"Adequate wellbeing"}'::JSONB,
    true
  )
ON CONFLICT (type_key) DO NOTHING;

-- ─── prompt_registry ───
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

-- ─── notification_templates ───
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

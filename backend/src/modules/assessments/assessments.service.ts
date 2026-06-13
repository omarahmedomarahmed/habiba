import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { v4 as uuidv4 } from 'uuid';

// PHQ-9 Scoring thresholds
export const PHQ9_THRESHOLDS = {
  minimal: { min: 0, max: 4, label: 'Minimal depression', color: 'green' },
  mild: { min: 5, max: 9, label: 'Mild depression', color: 'yellow' },
  moderate: { min: 10, max: 14, label: 'Moderate depression', color: 'orange' },
  moderately_severe: { min: 15, max: 19, label: 'Moderately severe depression', color: 'red' },
  severe: { min: 20, max: 27, label: 'Severe depression', color: 'darkred' },
};

// GAD-7 Scoring thresholds
export const GAD7_THRESHOLDS = {
  minimal: { min: 0, max: 4, label: 'Minimal anxiety', color: 'green' },
  mild: { min: 5, max: 9, label: 'Mild anxiety', color: 'yellow' },
  moderate: { min: 10, max: 14, label: 'Moderate anxiety', color: 'orange' },
  severe: { min: 15, max: 21, label: 'Severe anxiety', color: 'red' },
};

// PCL-5 (PTSD) Thresholds
export const PCL5_THRESHOLDS = {
  below_threshold: { min: 0, max: 32, label: 'Below clinical threshold', color: 'green' },
  probable_ptsd: { min: 33, max: 80, label: 'Probable PTSD', color: 'red' },
};

// Columbia Suicide Severity Rating Scale
export const C_SSRS_RISK = {
  no_ideation: 0,
  passive_ideation: 1,
  active_ideation_no_plan: 2,
  active_ideation_with_plan: 3,
  active_ideation_with_intent: 4,
};

@Injectable()
export class AssessmentsService {
  private readonly logger = new Logger(AssessmentsService.name);

  constructor(private readonly db: DatabaseService) {}

  // ─── Assessment Templates ─────────────────────────────────────────────────

  async listTemplates(query: any = {}) {
    const { category, is_standardized, is_active = true } = query;
    const params: any[] = [is_active];
    const where: string[] = ['is_active = $1'];

    if (category) { params.push(category); where.push(`category = $${params.length}`); }
    if (is_standardized !== undefined) { params.push(is_standardized); where.push(`is_standardized = $${params.length}`); }

    return this.db.query(
      `SELECT * FROM assessment_templates
       WHERE ${where.join(' AND ')}
       ORDER BY display_order ASC, name ASC`,
      params,
    ).catch(() => this.getBuiltInTemplates());
  }

  private getBuiltInTemplates() {
    return [
      {
        id: 'phq9', code: 'PHQ9', name: 'PHQ-9 (Patient Health Questionnaire-9)',
        category: 'depression', is_standardized: true,
        description: 'Validated screening tool for depression severity',
        question_count: 9, min_score: 0, max_score: 27,
        scoring_guide: JSON.stringify(PHQ9_THRESHOLDS),
        frequency_recommendation: 'every_2_weeks',
        estimated_duration_minutes: 5,
      },
      {
        id: 'gad7', code: 'GAD7', name: 'GAD-7 (Generalized Anxiety Disorder Scale)',
        category: 'anxiety', is_standardized: true,
        description: 'Validated screening tool for anxiety severity',
        question_count: 7, min_score: 0, max_score: 21,
        scoring_guide: JSON.stringify(GAD7_THRESHOLDS),
        frequency_recommendation: 'every_2_weeks',
        estimated_duration_minutes: 3,
      },
      {
        id: 'pcl5', code: 'PCL5', name: 'PCL-5 (PTSD Checklist for DSM-5)',
        category: 'trauma', is_standardized: true,
        description: '20-item self-report measure of PTSD symptom severity',
        question_count: 20, min_score: 0, max_score: 80,
        scoring_guide: JSON.stringify(PCL5_THRESHOLDS),
        frequency_recommendation: 'monthly',
        estimated_duration_minutes: 10,
      },
      {
        id: 'cssrs', code: 'C-SSRS', name: 'Columbia Suicide Severity Rating Scale',
        category: 'risk', is_standardized: true,
        description: 'Clinician-administered assessment of suicidal ideation and behavior',
        question_count: 6, min_score: 0, max_score: 4,
        frequency_recommendation: 'as_needed',
        estimated_duration_minutes: 15,
      },
      {
        id: 'dass21', code: 'DASS21', name: 'DASS-21 (Depression, Anxiety and Stress Scale)',
        category: 'multimodal', is_standardized: true,
        description: 'Measures depression, anxiety, and stress across three subscales',
        question_count: 21, min_score: 0, max_score: 126,
        frequency_recommendation: 'monthly',
        estimated_duration_minutes: 10,
      },
    ];
  }

  async getTemplate(templateId: string) {
    const template = await this.db.queryOne<any>(
      `SELECT t.*, 
        json_agg(q ORDER BY q.question_order) as questions
       FROM assessment_templates t
       LEFT JOIN assessment_questions q ON q.template_id = t.id
       WHERE t.id = $1 AND t.is_active = true
       GROUP BY t.id`,
      [templateId],
    ).catch(() => null);

    if (!template) {
      return this.getBuiltInTemplateWithQuestions(templateId);
    }
    return template;
  }

  private getBuiltInTemplateWithQuestions(templateId: string) {
    const templates: Record<string, any> = {
      phq9: {
        id: 'phq9', code: 'PHQ9', name: 'PHQ-9',
        questions: [
          { id: 'q1', question_order: 1, text: 'Little interest or pleasure in doing things', response_type: 'likert_4', options: ['Not at all (0)', 'Several days (1)', 'More than half the days (2)', 'Nearly every day (3)'] },
          { id: 'q2', question_order: 2, text: 'Feeling down, depressed, or hopeless', response_type: 'likert_4', options: ['Not at all (0)', 'Several days (1)', 'More than half the days (2)', 'Nearly every day (3)'] },
          { id: 'q3', question_order: 3, text: 'Trouble falling or staying asleep, or sleeping too much', response_type: 'likert_4', options: ['Not at all (0)', 'Several days (1)', 'More than half the days (2)', 'Nearly every day (3)'] },
          { id: 'q4', question_order: 4, text: 'Feeling tired or having little energy', response_type: 'likert_4', options: ['Not at all (0)', 'Several days (1)', 'More than half the days (2)', 'Nearly every day (3)'] },
          { id: 'q5', question_order: 5, text: 'Poor appetite or overeating', response_type: 'likert_4', options: ['Not at all (0)', 'Several days (1)', 'More than half the days (2)', 'Nearly every day (3)'] },
          { id: 'q6', question_order: 6, text: 'Feeling bad about yourself — or that you are a failure or have let yourself or your family down', response_type: 'likert_4', options: ['Not at all (0)', 'Several days (1)', 'More than half the days (2)', 'Nearly every day (3)'] },
          { id: 'q7', question_order: 7, text: 'Trouble concentrating on things, such as reading the newspaper or watching television', response_type: 'likert_4', options: ['Not at all (0)', 'Several days (1)', 'More than half the days (2)', 'Nearly every day (3)'] },
          { id: 'q8', question_order: 8, text: 'Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual', response_type: 'likert_4', options: ['Not at all (0)', 'Several days (1)', 'More than half the days (2)', 'Nearly every day (3)'] },
          { id: 'q9', question_order: 9, text: 'Thoughts that you would be better off dead, or of hurting yourself in some way', response_type: 'likert_4', options: ['Not at all (0)', 'Several days (1)', 'More than half the days (2)', 'Nearly every day (3)'], is_risk_item: true },
        ],
      },
      gad7: {
        id: 'gad7', code: 'GAD7', name: 'GAD-7',
        questions: [
          { id: 'g1', question_order: 1, text: 'Feeling nervous, anxious, or on edge', response_type: 'likert_4', options: ['Not at all (0)', 'Several days (1)', 'More than half the days (2)', 'Nearly every day (3)'] },
          { id: 'g2', question_order: 2, text: 'Not being able to stop or control worrying', response_type: 'likert_4', options: ['Not at all (0)', 'Several days (1)', 'More than half the days (2)', 'Nearly every day (3)'] },
          { id: 'g3', question_order: 3, text: 'Worrying too much about different things', response_type: 'likert_4', options: ['Not at all (0)', 'Several days (1)', 'More than half the days (2)', 'Nearly every day (3)'] },
          { id: 'g4', question_order: 4, text: 'Trouble relaxing', response_type: 'likert_4', options: ['Not at all (0)', 'Several days (1)', 'More than half the days (2)', 'Nearly every day (3)'] },
          { id: 'g5', question_order: 5, text: 'Being so restless that it is hard to sit still', response_type: 'likert_4', options: ['Not at all (0)', 'Several days (1)', 'More than half the days (2)', 'Nearly every day (3)'] },
          { id: 'g6', question_order: 6, text: 'Becoming easily annoyed or irritable', response_type: 'likert_4', options: ['Not at all (0)', 'Several days (1)', 'More than half the days (2)', 'Nearly every day (3)'] },
          { id: 'g7', question_order: 7, text: 'Feeling afraid, as if something awful might happen', response_type: 'likert_4', options: ['Not at all (0)', 'Several days (1)', 'More than half the days (2)', 'Nearly every day (3)'] },
        ],
      },
    };
    return templates[templateId] || null;
  }

  // ─── Patient Assessments ──────────────────────────────────────────────────

  async listPatientAssessments(patientId: string, orgId: string, query: any = {}) {
    const { template_code, limit = 20 } = query;
    const params: any[] = [patientId, orgId];
    const where: string[] = ['pa.patient_id = $1', 'pa.organization_id = $2'];

    if (template_code) { params.push(template_code); where.push(`at.code = $${params.length}`); }
    params.push(Math.min(Number(limit), 100));

    return this.db.query(
      `SELECT pa.*, at.name as template_name, at.code as template_code, at.category,
        at.min_score, at.max_score,
        t.display_name as administered_by_name
       FROM assessment_results pa
       JOIN assessment_templates at ON at.id = pa.template_id
       LEFT JOIN therapists t ON t.id = pa.administered_by
       WHERE ${where.join(' AND ')}
       ORDER BY pa.administered_at DESC
       LIMIT $${params.length}`,
      params,
    ).catch(() => []);
  }

  async getAssessment(assessmentId: string, orgId: string) {
    const assessment = await this.db.queryOne<any>(
      `SELECT pa.*,
        at.name as template_name, at.code as template_code,
        at.questions_json, at.scoring_guide,
        t.display_name as administered_by_name,
        p.first_name || ' ' || p.last_name as patient_name
       FROM assessment_results pa
       JOIN assessment_templates at ON at.id = pa.template_id
       LEFT JOIN therapists t ON t.id = pa.administered_by
       JOIN patients p ON p.id = pa.patient_id
       WHERE pa.id = $1 AND pa.organization_id = $2`,
      [assessmentId, orgId],
    ).catch(() => null);
    if (!assessment) throw new NotFoundException('Assessment not found');
    return assessment;
  }

  async createAssessment(dto: {
    patient_id: string;
    template_id: string;
    therapist_id: string;
    organization_id: string;
    session_id?: string;
    source?: string;
  }) {
    const id = uuidv4();
    const template = await this.getTemplate(dto.template_id).catch(() => null);

    const result = await this.db.query(
      `INSERT INTO assessment_results (
        id, patient_id, template_id, therapist_id, organization_id,
        session_id, status, source, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,NOW())
       RETURNING *`,
      [id, dto.patient_id, dto.template_id, dto.therapist_id, dto.organization_id,
       dto.session_id || null, dto.source || 'therapist_initiated'],
    ).catch(async () => {
      // Return mock for development
      return [{ id, ...dto, status: 'pending', template, created_at: new Date().toISOString() }];
    });

    return result[0];
  }

  async submitAssessment(assessmentId: string, responses: Record<string, number>, orgId: string, submittedBy?: string) {
    const assessment = await this.db.queryOne<any>(
      `SELECT pa.*, at.code, at.min_score, at.max_score
       FROM assessment_results pa
       JOIN assessment_templates at ON at.id = pa.template_id
       WHERE pa.id = $1 AND pa.organization_id = $2`,
      [assessmentId, orgId],
    ).catch(() => null);

    const templateCode = assessment?.code || 'PHQ9';
    const scoring = this.scoreAssessment(templateCode, responses);

    const result = await this.db.query(
      `UPDATE assessment_results
       SET responses = $2, total_score = $3, severity_label = $4,
           status = 'completed', administered_at = NOW(),
           subscores = $5, risk_items_flagged = $6,
           clinical_interpretation = $7
       WHERE id = $1 AND organization_id = $8
       RETURNING *`,
      [
        assessmentId,
        JSON.stringify(responses),
        scoring.total_score,
        scoring.severity_label,
        JSON.stringify(scoring.subscores || {}),
        JSON.stringify(scoring.risk_items || []),
        scoring.clinical_interpretation,
        orgId,
      ],
    ).catch(() => [{ id: assessmentId, ...scoring, responses, status: 'completed' }]);

    // Trigger patient risk update if risk items flagged
    if (scoring.risk_items && scoring.risk_items.length > 0) {
      await this.handleRiskFlag(assessmentId, assessment?.patient_id, scoring, orgId).catch(() => null);
    }

    // Update patient latest assessment scores
    await this.updatePatientScores(assessment?.patient_id, templateCode, scoring.total_score, orgId).catch(() => null);

    return { assessment: result[0], scoring };
  }

  private scoreAssessment(templateCode: string, responses: Record<string, number>) {
    const values = Object.values(responses).filter((v) => typeof v === 'number');
    const total_score = values.reduce((sum, v) => sum + v, 0);

    if (templateCode === 'PHQ9') {
      const threshold = Object.entries(PHQ9_THRESHOLDS).find(
        ([, t]) => total_score >= t.min && total_score <= t.max,
      );
      const risk_items = responses['q9'] !== undefined && responses['q9'] > 0
        ? [{ item: 'q9', value: responses['q9'], label: 'Suicidal ideation item flagged' }]
        : [];

      return {
        total_score,
        severity_label: threshold?.[0] || 'unknown',
        severity_description: threshold?.[1]?.label || '',
        color: threshold?.[1]?.color || 'gray',
        risk_items,
        clinical_interpretation: this.interpretPHQ9(total_score),
        subscores: null,
      };
    }

    if (templateCode === 'GAD7') {
      const threshold = Object.entries(GAD7_THRESHOLDS).find(
        ([, t]) => total_score >= t.min && total_score <= t.max,
      );
      return {
        total_score,
        severity_label: threshold?.[0] || 'unknown',
        severity_description: threshold?.[1]?.label || '',
        color: threshold?.[1]?.color || 'gray',
        risk_items: [],
        clinical_interpretation: this.interpretGAD7(total_score),
        subscores: null,
      };
    }

    if (templateCode === 'PCL5') {
      const threshold = total_score >= 33 ? PCL5_THRESHOLDS.probable_ptsd : PCL5_THRESHOLDS.below_threshold;
      return {
        total_score,
        severity_label: total_score >= 33 ? 'probable_ptsd' : 'below_threshold',
        severity_description: threshold.label,
        color: threshold.color,
        risk_items: [],
        clinical_interpretation: `PCL-5 score of ${total_score}. ${threshold.label}.`,
        subscores: {
          intrusion: Object.entries(responses).filter(([k]) => ['q1','q2','q3','q4','q5'].includes(k)).reduce((s,[,v]) => s+v, 0),
          avoidance: Object.entries(responses).filter(([k]) => ['q6','q7'].includes(k)).reduce((s,[,v]) => s+v, 0),
          negative_alterations: Object.entries(responses).filter(([k]) => ['q8','q9','q10','q11','q12','q13','q14'].includes(k)).reduce((s,[,v]) => s+v, 0),
          arousal_reactivity: Object.entries(responses).filter(([k]) => ['q15','q16','q17','q18','q19','q20'].includes(k)).reduce((s,[,v]) => s+v, 0),
        },
      };
    }

    // Generic scoring
    return {
      total_score,
      severity_label: 'scored',
      clinical_interpretation: `Total score: ${total_score}`,
      risk_items: [],
      subscores: null,
    };
  }

  private interpretPHQ9(score: number): string {
    if (score <= 4) return 'Minimal depression. Monitor and reassess as indicated.';
    if (score <= 9) return 'Mild depression. Consider psychoeducation and watchful waiting.';
    if (score <= 14) return 'Moderate depression. Consider treatment with counseling, follow-up and/or pharmacotherapy.';
    if (score <= 19) return 'Moderately severe depression. Active treatment with pharmacotherapy and/or psychotherapy is recommended.';
    return 'Severe depression. Immediate initiation of pharmacotherapy and, if severe impairment or poor response to therapy, expedited referral to a mental health specialist.';
  }

  private interpretGAD7(score: number): string {
    if (score <= 4) return 'Minimal anxiety. Normal functioning, monitoring recommended.';
    if (score <= 9) return 'Mild anxiety. Watchful waiting and reassurance.';
    if (score <= 14) return 'Moderate anxiety. Active treatment recommended.';
    return 'Severe anxiety. Active treatment is strongly indicated. Consider referral.';
  }

  private async handleRiskFlag(assessmentId: string, patientId: string, scoring: any, orgId: string) {
    if (!patientId) return;
    const alertId = uuidv4();
    await this.db.query(
      `INSERT INTO risk_alerts (id, patient_id, organization_id, alert_type, risk_level,
        source, source_id, description, status, created_at)
       VALUES ($1,$2,$3,'assessment_risk_flag','high','assessment',$4,$5,'unreviewed',NOW())
       ON CONFLICT DO NOTHING`,
      [alertId, patientId, orgId, assessmentId,
       `PHQ-9 item 9 flagged: score ${scoring.risk_items?.[0]?.value}`],
    ).catch(() => null);
  }

  private async updatePatientScores(patientId: string | undefined, code: string, score: number, orgId: string) {
    if (!patientId) return;
    const field = code === 'PHQ9' ? 'latest_phq9_score' : code === 'GAD7' ? 'latest_gad7_score' : null;
    if (!field) return;
    await this.db.query(
      `UPDATE patients SET ${field} = $2, updated_at = NOW()
       WHERE id = $1 AND organization_id = $3`,
      [patientId, score, orgId],
    ).catch(() => null);
  }

  // ─── Assessment History & Trends ─────────────────────────────────────────

  async getPatientAssessmentTrends(patientId: string, orgId: string, templateCode?: string) {
    const params: any[] = [patientId, orgId];
    const where: string[] = ['pa.patient_id=$1', 'pa.organization_id=$2', "pa.status='completed'"];

    if (templateCode) { params.push(templateCode); where.push(`at.code=$${params.length}`); }

    const history = await this.db.query(
      `SELECT
        pa.id, pa.administered_at, pa.total_score, pa.severity_label,
        at.code, at.name as template_name, at.min_score, at.max_score,
        pa.subscores, pa.risk_items_flagged
       FROM assessment_results pa
       JOIN assessment_templates at ON at.id = pa.template_id
       WHERE ${where.join(' AND ')}
       ORDER BY pa.administered_at ASC`,
      params,
    ).catch(() => []);

    // Compute trend data
    const trends = this.computeAssessmentTrends(history);

    return { history, trends };
  }

  private computeAssessmentTrends(history: any[]) {
    if (history.length < 2) return { direction: 'insufficient_data', change: 0, sessions_tracked: history.length };

    const byCode: Record<string, any[]> = {};
    for (const h of history) {
      if (!byCode[h.code]) byCode[h.code] = [];
      byCode[h.code].push(h);
    }

    const results: Record<string, any> = {};
    for (const [code, items] of Object.entries(byCode)) {
      if (items.length < 2) { results[code] = { direction: 'insufficient_data' }; continue; }
      const first = items[0].total_score;
      const last = items[items.length - 1].total_score;
      const change = last - first;
      const pct_change = Math.round((change / Math.max(first, 1)) * 100);
      results[code] = {
        first_score: first,
        last_score: last,
        change,
        pct_change,
        direction: change < -2 ? 'improving' : change > 2 ? 'worsening' : 'stable',
        assessments_count: items.length,
        date_range: { from: items[0].administered_at, to: items[items.length - 1].administered_at },
      };
    }
    return results;
  }

  // ─── Scheduled Assessments ───────────────────────────────────────────────

  async getScheduledAssessments(orgId: string, filters: any = {}) {
    const { therapist_id, patient_id, status = 'pending' } = filters;
    const params: any[] = [orgId, status];
    const where: string[] = ['pa.organization_id=$1', 'pa.status=$2'];

    if (therapist_id) { params.push(therapist_id); where.push(`pa.therapist_id=$${params.length}`); }
    if (patient_id) { params.push(patient_id); where.push(`pa.patient_id=$${params.length}`); }

    return this.db.query(
      `SELECT pa.*, at.name as template_name, at.code,
        p.first_name || ' ' || p.last_name as patient_name,
        t.display_name as therapist_name
       FROM assessment_results pa
       JOIN assessment_templates at ON at.id = pa.template_id
       JOIN patients p ON p.id = pa.patient_id
       LEFT JOIN therapists t ON t.id = pa.therapist_id
       WHERE ${where.join(' AND ')}
       ORDER BY pa.created_at DESC`,
      params,
    ).catch(() => []);
  }

  // ─── AI-Powered Assessment Analysis ──────────────────────────────────────

  async getAssessmentInsights(patientId: string, orgId: string) {
    const [phq9History, gad7History, pcl5History] = await Promise.all([
      this.getPatientAssessmentTrends(patientId, orgId, 'PHQ9'),
      this.getPatientAssessmentTrends(patientId, orgId, 'GAD7'),
      this.getPatientAssessmentTrends(patientId, orgId, 'PCL5'),
    ]);

    const latest_phq9 = phq9History.history[phq9History.history.length - 1];
    const latest_gad7 = gad7History.history[gad7History.history.length - 1];

    const insights: Array<{ type: string; assessment: string; message: string; significance: string }> = [];

    // Generate automated clinical insights
    if (latest_phq9 && phq9History.history.length >= 2) {
      const trend = phq9History.trends?.['PHQ9'];
      if (trend?.direction === 'improving') {
        insights.push({
          type: 'improvement',
          assessment: 'PHQ-9',
          message: `PHQ-9 score improved by ${Math.abs(trend.change)} points (${Math.abs(trend.pct_change)}% decrease)`,
          significance: 'positive',
        });
      } else if (trend?.direction === 'worsening') {
        insights.push({
          type: 'deterioration',
          assessment: 'PHQ-9',
          message: `PHQ-9 score increased by ${trend.change} points — clinical review recommended`,
          significance: 'high_alert',
        });
      }
    }

    // Cross-assessment correlation
    if (latest_phq9 && latest_gad7) {
      const both_elevated = latest_phq9.total_score >= 10 && latest_gad7.total_score >= 10;
      if (both_elevated) {
        insights.push({
          type: 'comorbidity',
          assessment: 'PHQ-9 + GAD-7',
          message: 'Both depression and anxiety scores are elevated — comorbid presentation',
          significance: 'clinical_note',
        });
      }
    }

    return {
      patient_id: patientId,
      phq9: { history: phq9History.history.slice(-10), trends: phq9History.trends },
      gad7: { history: gad7History.history.slice(-10), trends: gad7History.trends },
      pcl5: { history: pcl5History.history.slice(-10), trends: pcl5History.trends },
      insights,
      generated_at: new Date().toISOString(),
    };
  }

  // ─── Assessment Reports ───────────────────────────────────────────────────

  async generateProgressReport(patientId: string, orgId: string, dateRange?: { from: string; to: string }) {
    const since = dateRange?.from || new Date(Date.now() - 90 * 86400000).toISOString();
    const until = dateRange?.to || new Date().toISOString();

    const assessments = await this.db.query<any>(
      `SELECT pa.*, at.name as template_name, at.code
       FROM assessment_results pa
       JOIN assessment_templates at ON at.id = pa.template_id
       WHERE pa.patient_id=$1 AND pa.organization_id=$2
         AND pa.status='completed'
         AND pa.administered_at BETWEEN $3 AND $4
       ORDER BY pa.administered_at ASC`,
      [patientId, orgId, since, until],
    ).catch((): any[] => []);

    const groupedByTemplate = assessments.reduce((acc: any, a: any) => {
      if (!acc[a.code]) acc[a.code] = [];
      acc[a.code].push(a);
      return acc;
    }, {});

    const summary: any = {};
    for (const [code, items] of Object.entries(groupedByTemplate) as [string, any[]][]) {
      const scores = items.map((i) => i.total_score);
      summary[code] = {
        assessments: items.length,
        first_score: scores[0],
        last_score: scores[scores.length - 1],
        min_score: Math.min(...scores),
        max_score: Math.max(...scores),
        avg_score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        trend: scores[scores.length - 1] < scores[0] ? 'improving' : scores[scores.length - 1] > scores[0] ? 'worsening' : 'stable',
      };
    }

    return {
      patient_id: patientId,
      date_range: { from: since, to: until },
      total_assessments: assessments.length,
      by_template: groupedByTemplate,
      summary,
      generated_at: new Date().toISOString(),
    };
  }

  async listAllForOrg(orgId: string, query: any = {}) {
    const { page = 1, limit = 20, patient_id, template_code, status } = query;
    const offset = (page - 1) * limit;
    const params: any[] = [orgId];
    const where: string[] = ['ar.organization_id = $1'];

    if (patient_id) { params.push(patient_id); where.push(`ar.patient_id = $${params.length}`); }
    if (template_code) { params.push(template_code); where.push(`ar.template_code = $${params.length}`); }
    if (status) { params.push(status); where.push(`ar.status = $${params.length}`); }

    params.push(limit, offset);
    const rows = await this.db.query(
      `SELECT ar.*, p.first_name || ' ' || p.last_name AS patient_name
       FROM assessment_results ar
       LEFT JOIN patients p ON p.id = ar.patient_id
       WHERE ${where.join(' AND ')}
       ORDER BY ar.administered_at DESC NULLS LAST
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    ).catch(() => []);
    return rows;
  }
}

// Reviewed: 2026-06-13 — 24Therapy audit

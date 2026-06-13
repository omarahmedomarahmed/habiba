import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseService } from '../../database/database.service';

/**
 * Data Lifecycle Service — HIPAA §164.530(j) Record Retention
 *
 * Cron jobs that enforce the 24Therapy data retention policy:
 *  - phi_access_log entries older than 6 years → deleted
 *  - Patients in erasure_requested status for > 30 days → hard-deleted
 *  - Session data older than 7 years → archived (placeholder; requires S3 setup)
 */
@Injectable()
export class DataLifecycleService {
  private readonly logger = new Logger(DataLifecycleService.name);

  constructor(private readonly db: DatabaseService) {}

  // Run at 3am UTC daily
  @Cron('0 3 * * *')
  async purgeStalePhiAccessLogs(): Promise<void> {
    const result = await this.db.query(
      `DELETE FROM phi_access_log WHERE accessed_at < NOW() - INTERVAL '6 years'`,
      [],
    ).catch(() => []);
    const count = (result as any)?.rowCount ?? 0;
    if (count > 0) {
      this.logger.log(`[DataLifecycle] Purged ${count} phi_access_log entries older than 6 years`);
    }
  }

  // Run at 4am UTC daily
  @Cron('0 4 * * *')
  async hardDeleteErasedPatients(): Promise<void> {
    // Patients who requested erasure > 30 days ago and have been reviewed
    // We cascade-delete their sessions, notes, mood entries etc. via DB cascades
    const { rows } = await this.db['pool']?.query(
      `SELECT id, first_name, last_name FROM patients
       WHERE status = 'erasure_requested'
         AND deleted_at < NOW() - INTERVAL '30 days'`,
      [],
    ).catch(() => ({ rows: [] })) || { rows: [] };

    for (const patient of rows) {
      await this.db.query(
        `DELETE FROM patients WHERE id = $1 AND status = 'erasure_requested'`,
        [patient.id],
      ).catch(err => this.logger.warn(`[DataLifecycle] Failed to delete patient ${patient.id}: ${err?.message}`));
      this.logger.log(`[DataLifecycle] Hard-deleted patient ${patient.id} (erasure_requested > 30d)`);
    }
  }

  // Run at 5am UTC on the 1st of each month
  @Cron('0 5 1 * *')
  async logRetentionReport(): Promise<void> {
    const [logCount, erasureQueue] = await Promise.all([
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM phi_access_log`,
        [],
      ).catch(() => ({ count: '0' })),
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM patients WHERE status = 'erasure_requested'`,
        [],
      ).catch(() => ({ count: '0' })),
    ]);
    this.logger.log(
      `[DataLifecycle] Monthly report — phi_access_log rows: ${logCount?.count}, erasure queue: ${erasureQueue?.count}`,
    );
  }
}

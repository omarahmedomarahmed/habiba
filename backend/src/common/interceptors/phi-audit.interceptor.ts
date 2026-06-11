import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { DatabaseService } from '../../database/database.service';

// Routes that touch PHI — we log every successful read or write
const PHI_ROUTE_PATTERNS = [
  /^\/api\/v1\/patients/,
  /^\/api\/v1\/sessions/,
  /^\/api\/v1\/notes/,
  /^\/api\/v1\/assessments/,
  /^\/api\/v1\/memory/,
  /^\/api\/v1\/ai\/sessions/,
  /^\/api\/v1\/ai\/patients/,
];

function isPhiRoute(path: string): boolean {
  return PHI_ROUTE_PATTERNS.some(p => p.test(path));
}

function resourceTypeFromPath(path: string): string {
  const segment = path.replace('/api/v1/', '').split('/')[0];
  return segment || 'unknown';
}

@Injectable()
export class PhiAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PhiAuditInterceptor.name);

  constructor(private readonly db: DatabaseService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();

    if (!isPhiRoute(req.path)) return next.handle();

    return next.handle().pipe(
      tap({
        next: () => {
          // Fire-and-forget — never block the response
          this.logAccess(req).catch(err =>
            this.logger.warn(`PHI audit log failed: ${err?.message}`)
          );
        },
      })
    );
  }

  private async logAccess(req: Record<string, unknown>): Promise<void> {
    const user = req.user as Record<string, unknown> | undefined;
    if (!user?.userId) return; // unauthenticated requests not logged here

    const params = req.params as Record<string, string> | undefined;
    const patientId = params?.id || params?.patientId || null;

    await this.db.query(
      `INSERT INTO phi_access_log
         (user_id, organization_id, patient_id, resource_type, resource_id, access_type, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING`,
      [
        user.userId,
        user.organization_id || null,
        patientId,
        resourceTypeFromPath(req.path as string),
        patientId,
        (req.method as string) || 'GET',
        (req.ip as string) || null,
      ]
    );
  }
}

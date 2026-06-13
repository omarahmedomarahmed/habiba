import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserData {
  userId: string;
  email: string;
  role: string;
  organizationId: string;
  therapistId?: string;
  patientId?: string;
}

/**
 * @CurrentUser() decorator - extracts authenticated user from request
 * Usage: getProfile(@CurrentUser() user: CurrentUserData)
 */
export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserData | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as CurrentUserData;
    return data ? user?.[data] : user;
  },
);

// Reviewed: 2026-06-13 — 24Therapy audit

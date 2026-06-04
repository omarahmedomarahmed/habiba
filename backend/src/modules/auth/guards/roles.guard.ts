import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Role-Based Access Control Guard
 *
 * Works in conjunction with @Roles() decorator.
 * Enforces that the authenticated user has one of the required roles.
 * Must be used AFTER JwtAuthGuard in guard chain.
 *
 * Role hierarchy:
 * super_admin > admin > manager > therapist > assistant > billing > support > patient
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private static readonly ROLE_HIERARCHY: Record<string, number> = {
    super_admin: 100,
    admin: 80,
    manager: 60,
    therapist: 50,
    assistant: 40,
    billing: 35,
    support: 30,
    patient: 10,
  };

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const hasRole = requiredRoles.some((role) => {
      // Exact match
      if (user.role === role) return true;
      // super_admin can do everything
      if (user.role === 'super_admin') return true;
      // Hierarchy check for 'admin_and_above' style patterns
      const userLevel =
        RolesGuard.ROLE_HIERARCHY[user.role] || 0;
      const requiredLevel = RolesGuard.ROLE_HIERARCHY[role] || 0;
      return userLevel >= requiredLevel;
    });

    if (!hasRole) {
      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredRoles.join(' or ')}`,
      );
    }

    return true;
  }
}

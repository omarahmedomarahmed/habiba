import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthTokens, User } from '@24therapy/types';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: User; tokens: AuthTokens; organization: any }> {
    // Check if email already exists globally
    const existingUser = await this.db.queryOne(
      'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1',
      [dto.email.toLowerCase()],
    );

    if (existingUser) {
      throw new ConflictException('Email address is already registered');
    }

    return this.db.transaction(async (client) => {
      // Create organization if none provided
      let orgId: string;
      let org: any;

      if (dto.organization_slug) {
        // Join existing org
        org = await this.db.queryOne(
          'SELECT id FROM organizations WHERE slug = $1 AND deleted_at IS NULL',
          [dto.organization_slug],
        );
        if (!org) throw new NotFoundException('Organization not found');
        orgId = org.id;
      } else {
        // Create new organization
        const orgName = dto.organization_name || `${dto.first_name}'s Practice`;
        const slug = this.generateSlug(orgName);
        const orgResult = await client.query(
          `INSERT INTO organizations (id, name, slug, organization_type, status, trial_ends_at)
           VALUES ($1, $2, $3, 'solo', 'trial', NOW() + INTERVAL '14 days')
           RETURNING *`,
          [uuidv4(), orgName, slug],
        );
        org = orgResult.rows[0];
        orgId = org.id;

        // Create org settings
        await client.query(
          'INSERT INTO organization_settings (id, organization_id) VALUES ($1, $2)',
          [uuidv4(), orgId],
        );
      }

      // Hash password
      const rounds = this.config.get<number>('security.bcryptRounds') || 12;
      const passwordHash = await bcrypt.hash(dto.password, rounds);

      // Create user
      const userId = uuidv4();
      const userResult = await client.query(
        `INSERT INTO users (id, organization_id, email, password_hash, first_name, last_name, role, status, email_verified_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW())
         RETURNING *`,
        [userId, orgId, dto.email.toLowerCase(), passwordHash, dto.first_name, dto.last_name, dto.role || 'therapist'],
      );
      const user = userResult.rows[0];

      // If therapist role, create therapist profile
      if (user.role === 'therapist') {
        await client.query(
          `INSERT INTO therapists (id, organization_id, user_id, display_name, availability_status, verification_status)
           VALUES ($1, $2, $3, $4, 'offline', 'pending')`,
          [uuidv4(), orgId, userId, `${dto.first_name} ${dto.last_name}`.trim()],
        );
      }

      // Generate tokens
      const tokens = await this.generateTokens(user, client);

      return { user: this.sanitizeUser(user), tokens, organization: org };
    });
  }

  async login(dto: LoginDto): Promise<{ user: User; tokens: AuthTokens; organization: any }> {
    // Find user
    const user = await this.db.queryOne<any>(
      `SELECT u.*, o.name as org_name, o.slug as org_slug, o.status as org_status
       FROM users u
       JOIN organizations o ON o.id = u.organization_id
       WHERE u.email = $1 AND u.deleted_at IS NULL
       LIMIT 1`,
      [dto.email.toLowerCase()],
    );

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check account status
    if (user.status === 'suspended') {
      throw new UnauthorizedException('Account has been suspended. Contact support.');
    }

    // Check lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new UnauthorizedException('Account temporarily locked. Try again later.');
    }

    // Verify password
    const passwordValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!passwordValid) {
      // Increment failed login count
      await this.db.execute(
        `UPDATE users SET failed_login_count = failed_login_count + 1,
         locked_until = CASE WHEN failed_login_count >= 4 THEN NOW() + INTERVAL '15 minutes' ELSE NULL END
         WHERE id = $1`,
        [user.id],
      );
      throw new UnauthorizedException('Invalid email or password');
    }

    // Reset failed login count
    await this.db.execute(
      `UPDATE users SET failed_login_count = 0, locked_until = NULL,
       last_login_at = NOW(), last_login_ip = $2
       WHERE id = $1`,
      [user.id, dto.ip_address || null],
    );

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      tokens,
      organization: {
        id: user.organization_id,
        name: user.org_name,
        slug: user.org_slug,
        status: user.org_status,
      },
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    // Find token hash
    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.db.queryOne<any>(
      `SELECT rt.*, u.id as user_id, u.organization_id, u.role, u.status
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL AND rt.expires_at > NOW()`,
      [tokenHash],
    );

    if (!storedToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Revoke old token (rotation)
    await this.db.execute(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1',
      [storedToken.id],
    );

    // Generate new tokens
    const user = { id: storedToken.user_id, organization_id: storedToken.organization_id, role: storedToken.role };
    return this.generateTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.db.execute(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
      [userId],
    );
  }

  async validateUser(userId: string, orgId: string): Promise<User | null> {
    const user = await this.db.queryOne<any>(
      `SELECT * FROM users WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL AND status = 'active'`,
      [userId, orgId],
    );
    return user ? this.sanitizeUser(user) : null;
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.db.queryOne<any>(
      'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email.toLowerCase()],
    );

    if (!user) return; // Don't reveal if email exists

    const token = uuidv4();
    const tokenHash = this.hashToken(token);

    await this.db.execute(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')`,
      [uuidv4(), user.id, `reset_${tokenHash}`],
    );

    // TODO: Send password reset email via notification service
    console.log(`Password reset token for ${email}: ${token}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = `reset_${this.hashToken(token)}`;
    const storedToken = await this.db.queryOne<any>(
      `SELECT * FROM refresh_tokens
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
      [tokenHash],
    );

    if (!storedToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const rounds = this.config.get<number>('security.bcryptRounds') || 12;
    const passwordHash = await bcrypt.hash(newPassword, rounds);

    await this.db.transaction(async (client) => {
      await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
        passwordHash,
        storedToken.user_id,
      ]);
      await client.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [
        storedToken.id,
      ]);
    });
  }

  private async generateTokens(user: any, client?: any): Promise<AuthTokens> {
    const payload = {
      sub: user.id,
      org: user.organization_id,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.config.get('jwt.accessExpiry') || '15m',
    });

    const refreshToken = uuidv4();
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const insertFn = client
      ? (sql: string, params: any[]) => client.query(sql, params)
      : (sql: string, params: any[]) => this.db.execute(sql, params);

    await insertFn(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
      [uuidv4(), user.id, tokenHash, expiresAt],
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 900, // 15 minutes
      token_type: 'Bearer',
    };
  }

  private hashToken(token: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${base}-${Math.random().toString(36).substr(2, 6)}`;
  }

  private sanitizeUser(user: any): User {
    const { password_hash, mfa_secret, ...safe } = user;
    return safe as User;
  }
}

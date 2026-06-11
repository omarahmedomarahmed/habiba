import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy, JwtPayload } from './jwt.strategy';
import { AuthService } from '../auth.service';

function makeConfig(): jest.Mocked<ConfigService> {
  return { get: jest.fn().mockReturnValue('dev-only-secret-change-me') } as unknown as jest.Mocked<ConfigService>;
}

const IDENTITY = {
  id: 'user-1',
  userId: 'user-1',
  organization_id: 'org-1',
  organizationId: 'org-1',
  role: 'therapist',
  status: 'active',
};

async function buildStrategy(authService: Partial<AuthService>): Promise<JwtStrategy> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      JwtStrategy,
      { provide: ConfigService, useValue: makeConfig() },
      { provide: AuthService, useValue: authService },
    ],
  }).compile();
  return module.get(JwtStrategy);
}

describe('JwtStrategy — validate', () => {
  const PAYLOAD: JwtPayload = { sub: 'user-1', org: 'org-1', role: 'therapist' };

  it('returns user identity when user exists and is active', async () => {
    const authService = { getUserIdentity: jest.fn().mockResolvedValue(IDENTITY) };
    const strategy = await buildStrategy(authService);
    const result = await strategy.validate(PAYLOAD);
    expect(result).toEqual(IDENTITY);
    expect(authService.getUserIdentity).toHaveBeenCalledWith('user-1', 'org-1');
  });

  it('throws UnauthorizedException when user not found', async () => {
    const authService = { getUserIdentity: jest.fn().mockResolvedValue(null) };
    const strategy = await buildStrategy(authService);
    await expect(strategy.validate(PAYLOAD)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when getUserIdentity returns undefined', async () => {
    const authService = { getUserIdentity: jest.fn().mockResolvedValue(undefined) };
    const strategy = await buildStrategy(authService);
    await expect(strategy.validate(PAYLOAD)).rejects.toThrow(UnauthorizedException);
  });

  it('passes sub and org from payload to getUserIdentity', async () => {
    const authService = { getUserIdentity: jest.fn().mockResolvedValue(IDENTITY) };
    const strategy = await buildStrategy(authService);
    const payload: JwtPayload = { sub: 'user-99', org: 'org-99', role: 'admin' };
    await strategy.validate(payload);
    expect(authService.getUserIdentity).toHaveBeenCalledWith('user-99', 'org-99');
  });
});

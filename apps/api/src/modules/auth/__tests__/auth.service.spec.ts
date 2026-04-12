/**
 * Unit tests for AuthService – register, login, refresh, logout flows.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { Currency, UserRole } from '@prisma/client';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  passwordHash: '',  // set per test
  displayName: 'Test User',
  role: UserRole.USER,
  isActive: true,
  emailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const prismaMock = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  passwordReset: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

const jwtServiceMock = {
  sign: jest.fn().mockReturnValue('mock-access-token'),
};

const configServiceMock = {
  get: jest.fn().mockImplementation((key: string) => {
    const config: Record<string, string> = {
      'jwt.accessSecret': 'test-secret',
      'jwt.refreshSecret': 'test-refresh-secret',
      'jwt.accessExpiresIn': '15m',
      'jwt.refreshExpiresIn': '7d',
    };
    return config[key];
  }),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ─── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    it('throws ConflictException if email already exists', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(mockUser);

      await expect(
        service.register({ email: 'test@example.com', password: 'Password1!', displayName: 'Test' }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates user, settings, portfolio and returns tokens', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      prismaMock.user.create.mockResolvedValueOnce({
        id: 'new-user',
        email: 'new@example.com',
        displayName: 'New',
        role: UserRole.USER,
      });
      prismaMock.auditLog.create.mockResolvedValueOnce({});
      prismaMock.refreshToken.create.mockResolvedValueOnce({});

      const result = await service.register({
        email: 'new@example.com',
        password: 'Password1!',
        displayName: 'New',
      });

      expect(result).toHaveProperty('accessToken', 'mock-access-token');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user).toHaveProperty('email', 'new@example.com');
      expect(prismaMock.user.create).toHaveBeenCalled();
    });
  });

  // ─── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('throws UnauthorizedException for unknown email', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      const hash = await bcrypt.hash('correct-pass', 10);
      prismaMock.user.findUnique.mockResolvedValueOnce({ ...mockUser, passwordHash: hash });

      await expect(
        service.login({ email: mockUser.email, password: 'wrong-pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns tokens and user for valid credentials', async () => {
      const hash = await bcrypt.hash('Password1!', 10);
      prismaMock.user.findUnique.mockResolvedValueOnce({ ...mockUser, passwordHash: hash });
      prismaMock.auditLog.create.mockResolvedValueOnce({});
      prismaMock.refreshToken.create.mockResolvedValueOnce({});

      const result = await service.login({ email: mockUser.email, password: 'Password1!' });

      expect(result).toHaveProperty('accessToken', 'mock-access-token');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('throws UnauthorizedException for inactive user', async () => {
      const hash = await bcrypt.hash('Password1!', 10);
      prismaMock.user.findUnique.mockResolvedValueOnce({ ...mockUser, passwordHash: hash, isActive: false });

      await expect(
        service.login({ email: mockUser.email, password: 'Password1!' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── refresh ───────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('throws UnauthorizedException for unknown token', async () => {
      prismaMock.refreshToken.findUnique.mockResolvedValueOnce(null);

      await expect(service.refresh('invalid-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for revoked token', async () => {
      prismaMock.refreshToken.findUnique.mockResolvedValueOnce({
        id: 'rt1',
        revoked: true,
        expiresAt: new Date(Date.now() + 100000),
        user: { ...mockUser },
      });

      await expect(service.refresh('revoked-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for expired token', async () => {
      prismaMock.refreshToken.findUnique.mockResolvedValueOnce({
        id: 'rt1',
        revoked: false,
        expiresAt: new Date(Date.now() - 1000),  // expired
        user: { ...mockUser },
      });

      await expect(service.refresh('expired-token')).rejects.toThrow(UnauthorizedException);
    });

    it('rotates token and returns new tokens', async () => {
      prismaMock.refreshToken.findUnique.mockResolvedValueOnce({
        id: 'rt1',
        revoked: false,
        expiresAt: new Date(Date.now() + 100000),
        user: { id: mockUser.id, email: mockUser.email, role: mockUser.role, isActive: true },
      });
      prismaMock.refreshToken.update.mockResolvedValueOnce({});
      prismaMock.refreshToken.create.mockResolvedValueOnce({});

      const result = await service.refresh('valid-token');

      expect(result).toHaveProperty('accessToken', 'mock-access-token');
      expect(result).toHaveProperty('refreshToken');
      // Old token must be revoked
      expect(prismaMock.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { revoked: true } }),
      );
    });
  });
});

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { EmailService } from './email.service';
import { Currency } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 12;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, this.SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        displayName: dto.displayName,
        settings: {
          create: { baseCurrency: Currency.USD },
        },
        portfolios: {
          create: {
            name: 'Main Portfolio',
            isDefault: true,
            currency: Currency.USD,
          },
        },
      },
      select: { id: true, email: true, displayName: true, role: true },
    });

    await this.prisma.auditLog.create({
      data: { userId: user.id, action: 'REGISTER', entity: 'User', entityId: user.id },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    return { user, ...tokens };
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true, passwordHash: true, displayName: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');
    if (!user.passwordHash) throw new UnauthorizedException('This account uses social sign-in. Please use Google to log in.');

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        ipAddress,
        userAgent,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role, ipAddress, userAgent);
    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, ...tokens };
  }

  async refresh(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: { select: { id: true, email: true, role: true, isActive: true } } },
    });

    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!stored.user.isActive) throw new UnauthorizedException('Account inactive');

    // Rotate: revoke old, issue new
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

    const tokens = await this.generateTokens(stored.user.id, stored.user.email, stored.user.role);
    return tokens;
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { revoked: true },
    });
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Always return success to prevent email enumeration
    if (!user) return;

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.passwordReset.create({
      data: { userId: user.id, token, expiresAt },
    });

    // Send reset email (logs link to console if SMTP not configured)
    await this.email.sendPasswordReset(user.email, token);
  }

  async resetPassword(dto: ResetPasswordDto) {
    const reset = await this.prisma.passwordReset.findUnique({
      where: { token: dto.token },
      include: { user: true },
    });

    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, this.SALT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
      this.prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      // Revoke all refresh tokens for security
      this.prisma.refreshToken.updateMany({ where: { userId: reset.userId }, data: { revoked: true } }),
    ]);
  }

  /** Find existing user by email or create a new one for Google OAuth. */
  async findOrCreateGoogleUser(profile: { emails?: Array<{ value: string }>; displayName?: string }) {
    const email = profile.emails?.[0]?.value;
    if (!email) throw new UnauthorizedException('No email returned from Google');

    let user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, displayName: true, role: true, isActive: true },
    });

    if (!user) {
      // Create new user — passwordHash is a random unusable hash
      const randomHash = await bcrypt.hash(uuidv4(), 10);
      user = await this.prisma.user.create({
        data: {
          email,
          passwordHash: randomHash,
          displayName: profile.displayName ?? email.split('@')[0],
          emailVerified: true,
          settings: { create: { baseCurrency: Currency.USD } },
          portfolios: { create: { name: 'Main Portfolio', isDefault: true, currency: Currency.USD } },
        },
        select: { id: true, email: true, displayName: true, role: true, isActive: true },
      });

      await this.prisma.auditLog.create({
        data: { userId: user.id, action: 'REGISTER_GOOGLE', entity: 'User', entityId: user.id },
      });
    }

    if (!user.isActive) throw new UnauthorizedException('Account inactive');
    return user;
  }

  /** Issue tokens after Google OAuth validation. */
  async loginWithGoogle(user: { id: string; email: string; displayName?: string | null; role: string }) {
    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.prisma.auditLog.create({
      data: { userId: user.id, action: 'LOGIN_GOOGLE' },
    });
    return {
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
      ...tokens,
    };
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const payload: JwtPayload = { sub: userId, email, role };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: this.config.get<string>('jwt.accessExpiresIn'),
    });

    const refreshToken = uuidv4();
    const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn') ?? '7d';
    const days = parseInt(refreshExpiresIn.replace('d', ''), 10);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId, token: refreshToken, expiresAt, ipAddress, userAgent },
    });

    return { accessToken, refreshToken };
  }
}

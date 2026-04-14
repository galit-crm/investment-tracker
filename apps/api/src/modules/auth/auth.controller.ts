import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshDto } from './dto/refresh.dto';

const COOKIE_NAME = 'rt';

@Controller('auth')
export class AuthController {
  private readonly cookieMaxAge: number;
  private readonly isProd: boolean;

  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {
    const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn') ?? '7d';
    const days = parseInt(refreshExpiresIn.replace('d', ''), 10);
    this.cookieMaxAge = days * 24 * 60 * 60 * 1000;
    this.isProd = this.config.get<string>('nodeEnv') === 'production';
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    this.setRefreshCookie(res, result.refreshToken);
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, req.ip, req.headers['user-agent']);
    this.setRefreshCookie(res, result.refreshToken);
    return result;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Body() dto: Partial<RefreshDto>,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Cookie takes priority (more secure); body is fallback for non-browser clients
    const token = (req.cookies as Record<string, string>)[COOKIE_NAME] ?? dto.refreshToken;
    if (!token) {
      const { UnauthorizedException } = await import('@nestjs/common');
      throw new UnauthorizedException('Refresh token required');
    }

    const result = await this.authService.refresh(token);
    this.setRefreshCookie(res, result.refreshToken);
    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Body() dto: Partial<RefreshDto>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = (req.cookies as Record<string, string>)[COOKIE_NAME] ?? dto.refreshToken;
    if (token) {
      await this.authService.logout(token);
    }
    res.clearCookie(COOKIE_NAME, this.cookieOptions());
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // ─── Google OAuth ──────────────────────────────────────────────────────────

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    // Passport redirects to Google consent screen — no body needed
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const result = await this.authService.loginWithGoogle((req as any).user);
    this.setRefreshCookie(res, result.refreshToken);
    const frontendUrl = this.config.get<string>('frontendUrl') ?? 'http://localhost:3000';
    const userParam = Buffer.from(JSON.stringify(result.user)).toString('base64url');
    res.redirect(
      `${frontendUrl}/auth/google/callback?token=${encodeURIComponent(result.accessToken)}&u=${userParam}`,
    );
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.isProd,
      // cross-domain (Vercel ↔ Render) requires 'none'; 'none' requires secure:true
      sameSite: (this.isProd ? 'none' : 'lax') as 'none' | 'lax',
      path: '/',
    };
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(COOKIE_NAME, token, {
      ...this.cookieOptions(),
      maxAge: this.cookieMaxAge,
    });
  }
}

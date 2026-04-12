import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: config.get<string>('auth.googleClientId') || 'google_oauth_not_configured',
      clientSecret: config.get<string>('auth.googleClientSecret') || 'google_oauth_not_configured',
      callbackURL: `${config.get<string>('auth.googleCallbackUrl') ?? 'http://localhost:3001/api/v1/auth/google/callback'}`,
      scope: ['email', 'profile'],
    });
  }

  async validate(_accessToken: string, _refreshToken: string, profile: Profile) {
    // Called after Google confirms the user. Return user record for req.user.
    return this.authService.findOrCreateGoogleUser(profile);
  }
}

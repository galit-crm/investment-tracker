'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Handles the Google OAuth redirect from the backend.
 * Backend redirects to: /auth/google/callback?token=<accessToken>&u=<base64url_user>
 */

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400">Completing sign-in…</p>
      </div>
    </div>
  );
}

function GoogleCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const token = params.get('token');
    const userEncoded = params.get('u');

    if (!token || !userEncoded) {
      router.replace('/login?error=google_failed');
      return;
    }

    try {
      const user = JSON.parse(atob(userEncoded.replace(/-/g, '+').replace(/_/g, '/')));
      // Refresh token is stored as httpOnly cookie by the backend — pass empty string here
      setAuth(user, token, '');
      router.replace('/dashboard');
    } catch {
      router.replace('/login?error=google_failed');
    }
  }, [params, router, setAuth]);

  return <Spinner />;
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <GoogleCallbackInner />
    </Suspense>
  );
}

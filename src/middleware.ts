import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = req.nextUrl;

  // ── Grant public routes (applicant + evaluator login/register, invite links) ─
  const grantPublicPaths = [
    '/grants/login', '/grants/register', '/grants/auth',
    '/grants/evaluator/login', '/grants/evaluator/register',
    '/grants/apply/',  // Public invite link landing pages
  ];
  const isGrantPublicPath = grantPublicPaths.some(p => pathname.startsWith(p));

  if (isGrantPublicPath) {
    return res;
  }

  // ── Evaluator pending page (needs session but not approval) ──────────────
  if (pathname.startsWith('/grants/evaluator/pending')) {
    if (!session) {
      return NextResponse.redirect(new URL('/grants/evaluator/login', req.url));
    }
    return res;
  }

  // ── Evaluator portal routes (/grants/evaluator/portal/*) ────────────────
  if (pathname.startsWith('/grants/evaluator/portal')) {
    if (!session) {
      return NextResponse.redirect(new URL('/grants/evaluator/login', req.url));
    }
    return res;
  }

  // ── Grant applicant portal routes (/grants/portal/*) ─────────────────────
  if (pathname.startsWith('/grants/portal')) {
    if (!session) {
      return NextResponse.redirect(new URL('/grants/login', req.url));
    }
    return res;
  }

  // ── Public agenda routes (no auth required) ──────────────────────────────
  if (pathname.match(/^\/meetings\/[^/]+\/agenda\/public/) || pathname.startsWith('/api/meetings/public-agenda')) {
    return res;
  }

  // ── Foundation public routes (login, auth) ───────────────────────────────
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth') || pathname.startsWith('/auth/')) {
    if (session) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return res;
  }

  // ── API routes for grants (need auth but not necessarily foundation user) ─
  if (pathname.startsWith('/api/grants')) {
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return res;
  }

  // ── All other routes require foundation user session ─────────────────────
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};

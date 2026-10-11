import { NextRequest, NextResponse } from 'next/server';

// Native Capacitor HTTP does not require CORS. This enables browser previews
// only for explicitly configured origins (for example http://localhost:3000).
export function proxy(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowed = (process.env.COPTIC_ALLOWED_ORIGINS ?? '').split(',').map(x => x.trim()).filter(Boolean);
  const response = request.method === 'OPTIONS'
    ? new NextResponse(null, { status: 204 })
    : NextResponse.next();
  if (origin && allowed.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    response.headers.set('Vary', 'Origin');
  }
  return response;
}

export const config = { matcher: '/api/translate/:path*' };

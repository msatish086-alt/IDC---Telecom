import { NextResponse, type NextRequest } from 'next/server';
/** Send anyone without a session cookie to /login (the cookie itself is verified on the server). */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/login') || pathname.startsWith('/api/cron') || pathname.startsWith('/_next') || /\.(png|svg|webmanifest|js|ico)$/.test(pathname)) return NextResponse.next();
  if (!req.cookies.get('idc_session')) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
}
export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };

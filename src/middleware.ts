import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// MVP: Allow all requests through. Auth0 will be added later.
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};

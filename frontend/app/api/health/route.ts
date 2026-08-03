import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'keiba-frontend-v1',
      release: process.env.NEXT_PUBLIC_APP_RELEASE || 'local',
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  );
}

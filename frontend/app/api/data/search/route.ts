import { NextRequest, NextResponse } from 'next/server';
import { searchDataEntities } from '@/lib/api';


export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const query = (request.nextUrl.searchParams.get('q') || '').trim();
    if (!query) {
        return NextResponse.json({ query: '', total: 0, items: [] });
    }
    if (query.length > 60) {
        return NextResponse.json({ error: '検索語が長すぎます。' }, { status: 400 });
    }
    const result = await searchDataEntities(query, 30);
    if (!result) {
        return NextResponse.json({ error: '検索データを取得できません。' }, { status: 503 });
    }
    return NextResponse.json(result, {
        headers: { 'Cache-Control': 'private, max-age=0, no-store' },
    });
}

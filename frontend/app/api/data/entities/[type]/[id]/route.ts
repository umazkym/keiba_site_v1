import { NextRequest, NextResponse } from 'next/server';
import { getDataEntityDetail } from '@/lib/api';
import { CLOSED_DATA_ENTITY_TYPES } from '@/lib/closed-data-pages';


export const dynamic = 'force-dynamic';

type Props = {
    params: { type: string; id: string };
};

export async function GET(_request: NextRequest, { params }: Props) {
    // 競走馬・調教師のページは提供を終了した（2026-09-26）。個別データも返さない
    if (CLOSED_DATA_ENTITY_TYPES.has(params.type)) {
        return NextResponse.json({ error: '提供を終了しました。' }, { status: 410 });
    }
    if (params.type !== 'jockey') {
        return NextResponse.json({ error: '対象種別が不正です。' }, { status: 400 });
    }
    const result = await getDataEntityDetail(
        'jockey',
        params.id,
    );
    if (!result) {
        return NextResponse.json({ error: 'データが見つかりません。' }, { status: 404 });
    }
    return NextResponse.json(result, {
        headers: { 'Cache-Control': 'private, max-age=300' },
    });
}

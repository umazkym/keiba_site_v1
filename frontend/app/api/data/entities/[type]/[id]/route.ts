import { NextRequest, NextResponse } from 'next/server';
import { getDataEntityDetail } from '@/lib/api';


export const dynamic = 'force-dynamic';

type Props = {
    params: { type: string; id: string };
};

export async function GET(_request: NextRequest, { params }: Props) {
    if (!['horse', 'jockey', 'trainer'].includes(params.type)) {
        return NextResponse.json({ error: '対象種別が不正です。' }, { status: 400 });
    }
    const result = await getDataEntityDetail(
        params.type as 'horse' | 'jockey' | 'trainer',
        params.id,
    );
    if (!result) {
        return NextResponse.json({ error: 'データが見つかりません。' }, { status: 404 });
    }
    return NextResponse.json(result, {
        headers: { 'Cache-Control': 'private, max-age=300' },
    });
}

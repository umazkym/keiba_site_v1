import { NextRequest, NextResponse } from 'next/server';
import { getRaceDataFeatures } from '@/lib/api';


export const dynamic = 'force-dynamic';

type Props = {
    params: { id: string };
};

export async function GET(_request: NextRequest, { params }: Props) {
    const result = await getRaceDataFeatures(params.id);
    if (!result) {
        return NextResponse.json({ error: 'レース比較データが見つかりません。' }, { status: 404 });
    }
    return NextResponse.json(result, {
        headers: { 'Cache-Control': 'private, max-age=300' },
    });
}

import { NextRequest, NextResponse } from 'next/server';
import { compareHorseData } from '@/lib/api';
import type { HorseComparisonRequest } from '@/lib/types';


export const dynamic = 'force-dynamic';

const COURSE_TYPES = new Set(['芝', 'ダート', '障害']);

function isValidPayload(value: unknown): value is HorseComparisonRequest {
    if (!value || typeof value !== 'object') return false;
    const payload = value as Partial<HorseComparisonRequest>;
    return (
        Array.isArray(payload.horse_ids)
        && payload.horse_ids.length >= 2
        && payload.horse_ids.length <= 5
        && payload.horse_ids.every((id) => typeof id === 'string' && id.trim().length > 0)
        && new Set(payload.horse_ids).size === payload.horse_ids.length
        && typeof payload.venue_name === 'string'
        && payload.venue_name.trim().length > 0
        && typeof payload.course_type === 'string'
        && COURSE_TYPES.has(payload.course_type)
        && Number.isInteger(payload.distance)
        && Number(payload.distance) >= 200
        && Number(payload.distance) <= 5000
        && (
            payload.ground_condition == null
            || typeof payload.ground_condition === 'string'
        )
    );
}

export async function POST(request: NextRequest) {
    let payload: unknown;
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: '比較条件の形式が不正です。' }, { status: 400 });
    }
    if (!isValidPayload(payload)) {
        return NextResponse.json(
            { error: '競走馬2〜5頭とコース条件を指定してください。' },
            { status: 400 },
        );
    }

    const result = await compareHorseData({
        ...payload,
        horse_ids: payload.horse_ids.map((id) => id.trim()),
        venue_name: payload.venue_name.trim(),
        ground_condition: payload.ground_condition?.trim() || null,
    });
    if (!result) {
        return NextResponse.json(
            { error: '比較データを取得できませんでした。' },
            { status: 404 },
        );
    }
    return NextResponse.json(result, {
        headers: { 'Cache-Control': 'private, max-age=0, no-store' },
    });
}

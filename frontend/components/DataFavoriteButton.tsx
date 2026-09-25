'use client';

import { Bookmark } from 'lucide-react';
import { useEffect, useState } from 'react';
import { sendDataFavoriteEvent, type DataEntityEventType } from '@/lib/analytics';
import { isFavorite, toggleFavorite } from '@/lib/my-data';


type Props = {
    entityType: DataEntityEventType;
    entityId: string;
    name: string;
    subtitle: string;
    url: string;
    compact?: boolean;
    /**
     * データ詳細の見出しの右上に置く形（2026-09-25 スマホの見直し）。
     * スマホは高さ28pxの小さい「保存」（押せる範囲は hit-44 で44px以上）、640px以上は今までの「マイデータに保存」。
     */
    headPlacement?: boolean;
};

export function DataFavoriteButton({
    entityType,
    entityId,
    name,
    subtitle,
    url,
    compact = false,
    headPlacement = false,
}: Props) {
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        setSaved(isFavorite(entityType, entityId));
    }, [entityId, entityType]);

    const handleClick = () => {
        const result = toggleFavorite({
            entity_type: entityType,
            id: entityId,
            name,
            subtitle,
            url,
        });
        setSaved(result.added);
        sendDataFavoriteEvent({
            action: result.added ? 'add' : 'remove',
            entity_type: entityType,
            entity_id: entityId,
        });
    };

    const toneClass = saved
        ? 'border-brand-200 bg-brand-50 text-brand-800'
        : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:text-primary';
    const sizeClass = headPlacement
        ? 'hit-44 min-h-7 gap-1.5 rounded-[9px] px-2.5 sm:min-h-11 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2'
        : 'min-h-11 gap-2 rounded-xl px-3 py-2';
    const fullLabel = saved ? 'マイデータに保存済み' : 'マイデータに保存';
    const shortLabel = saved ? '保存済み' : '保存';

    return (
        <button
            type="button"
            onClick={handleClick}
            aria-pressed={saved}
            aria-label={headPlacement ? 'マイデータに保存' : undefined}
            className={`inline-flex cursor-pointer items-center justify-center border text-sm font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${sizeClass} ${toneClass}`}
        >
            <Bookmark className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} aria-hidden="true" />
            {headPlacement ? (
                <>
                    <span className="sm:hidden">{shortLabel}</span>
                    <span className="hidden sm:inline">{fullLabel}</span>
                </>
            ) : (compact ? shortLabel : fullLabel)}
        </button>
    );
}

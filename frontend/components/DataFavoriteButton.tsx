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
};

export function DataFavoriteButton({
    entityType,
    entityId,
    name,
    subtitle,
    url,
    compact = false,
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

    return (
        <button
            type="button"
            onClick={handleClick}
            aria-pressed={saved}
            className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                saved
                    ? 'border-blue-200 bg-blue-50 text-blue-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-primary'
            }`}
        >
            <Bookmark className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} aria-hidden="true" />
            {compact ? (saved ? '保存済み' : '保存') : (saved ? 'マイデータに保存済み' : 'マイデータに保存')}
        </button>
    );
}

import type { DataEntityType } from '@/lib/types';


export type SavedDataEntity = {
    entity_type: DataEntityType;
    id: string;
    name: string;
    subtitle: string;
    url: string;
    saved_at: number;
};

export type SavedHorseComparison = {
    id: string;
    name: string;
    url: string;
    saved_at: number;
};

export const DATA_FAVORITES_KEY = 'uma_data_favorites_v1';
export const HORSE_COMPARISON_KEY = 'uma_horse_comparison_v1';
export const DATA_HISTORY_KEY = 'uma_data_history_v1';
export const MY_DATA_UPDATED_EVENT = 'uma:my-data-updated';

const MAX_FAVORITES = 100;
const MAX_HISTORY = 30;
const MAX_COMPARISON_HORSES = 5;

function parseStoredList<T>(key: string): T[] {
    if (typeof window === 'undefined') return [];
    try {
        const parsed = JSON.parse(window.localStorage.getItem(key) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeStoredList<T>(key: string, items: T[]): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(key, JSON.stringify(items));
        window.dispatchEvent(new CustomEvent(MY_DATA_UPDATED_EVENT, { detail: { key } }));
    } catch {
        // プライベートブラウズ等で保存できない場合も閲覧自体は継続する。
    }
}

export function readFavorites(): SavedDataEntity[] {
    return parseStoredList<SavedDataEntity>(DATA_FAVORITES_KEY)
        .filter((item) => Boolean(item?.id && item?.name && item?.url))
        .slice(0, MAX_FAVORITES);
}

export function isFavorite(entityType: DataEntityType, id: string): boolean {
    return readFavorites().some(
        (item) => item.entity_type === entityType && item.id === id,
    );
}

export function toggleFavorite(entity: Omit<SavedDataEntity, 'saved_at'>): {
    added: boolean;
    items: SavedDataEntity[];
} {
    const current = readFavorites();
    const index = current.findIndex(
        (item) => item.entity_type === entity.entity_type && item.id === entity.id,
    );
    if (index >= 0) {
        const next = current.filter((_, itemIndex) => itemIndex !== index);
        writeStoredList(DATA_FAVORITES_KEY, next);
        return { added: false, items: next };
    }
    const next = [{ ...entity, saved_at: Date.now() }, ...current].slice(0, MAX_FAVORITES);
    writeStoredList(DATA_FAVORITES_KEY, next);
    return { added: true, items: next };
}

export function recordDataHistory(entity: Omit<SavedDataEntity, 'saved_at'>): void {
    const current = parseStoredList<SavedDataEntity>(DATA_HISTORY_KEY);
    const next = [
        { ...entity, saved_at: Date.now() },
        ...current.filter(
            (item) => !(item.entity_type === entity.entity_type && item.id === entity.id),
        ),
    ].slice(0, MAX_HISTORY);
    writeStoredList(DATA_HISTORY_KEY, next);
}

export function readDataHistory(): SavedDataEntity[] {
    return parseStoredList<SavedDataEntity>(DATA_HISTORY_KEY)
        .filter((item) => Boolean(item?.id && item?.name && item?.url))
        .slice(0, MAX_HISTORY);
}

export function readHorseComparison(): SavedHorseComparison[] {
    return parseStoredList<SavedHorseComparison>(HORSE_COMPARISON_KEY)
        .filter((item) => Boolean(item?.id && item?.name))
        .slice(0, MAX_COMPARISON_HORSES);
}

export function toggleHorseComparison(horse: Omit<SavedHorseComparison, 'saved_at'>): {
    added: boolean;
    full: boolean;
    items: SavedHorseComparison[];
} {
    const current = readHorseComparison();
    const exists = current.some((item) => item.id === horse.id);
    if (exists) {
        const next = current.filter((item) => item.id !== horse.id);
        writeStoredList(HORSE_COMPARISON_KEY, next);
        return { added: false, full: false, items: next };
    }
    if (current.length >= MAX_COMPARISON_HORSES) {
        return { added: false, full: true, items: current };
    }
    const next = [...current, { ...horse, saved_at: Date.now() }];
    writeStoredList(HORSE_COMPARISON_KEY, next);
    return { added: true, full: false, items: next };
}

export function clearHorseComparison(): void {
    writeStoredList(HORSE_COMPARISON_KEY, []);
}

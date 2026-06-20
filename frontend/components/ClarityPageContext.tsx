'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { sendClarityEvent, setClarityTag } from '@/lib/clarity';

const ENTRY_AREA_STORAGE_KEY = 'uma-free:clarity-entry-area';

const inferPageArea = (pathname: string) => {
    if (pathname === '/') return 'home';
    if (pathname === '/articles') return 'articles_index';
    if (pathname.startsWith('/articles/')) return 'article';
    if (/^\/races\/\d{4}-\d{2}-\d{2}\/[^/]+\/\d{1,2}$/.test(pathname)) {
        return 'race_detail';
    }
    if (pathname.startsWith('/races/')) return 'race_day';
    if (pathname.startsWith('/results/')) return 'results';
    if (pathname.startsWith('/keiba-data')) return 'data_guide';
    if (pathname.startsWith('/courses')) return 'courses';
    if (pathname.startsWith('/jockeys')) return 'jockeys';
    if (pathname === '/search') return 'search';
    return 'other';
};

export const ClarityPageContext = () => {
    const pathname = usePathname();

    useEffect(() => {
        const pageArea = inferPageArea(pathname);
        setClarityTag('visited_area', pageArea);
        sendClarityEvent(`view_${pageArea}`);

        try {
            const existingEntryArea = window.sessionStorage.getItem(ENTRY_AREA_STORAGE_KEY);
            if (existingEntryArea) {
                setClarityTag('entry_area', existingEntryArea);
                return;
            }

            window.sessionStorage.setItem(ENTRY_AREA_STORAGE_KEY, pageArea);
            setClarityTag('entry_area', pageArea);
        } catch {
            // sessionStorageを利用できない環境でもClarity本体の計測は継続する。
        }
    }, [pathname]);

    return null;
};

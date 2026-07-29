'use client';

import { useEffect } from 'react';

import { captureSocialVideoEntryAttribution } from '@/lib/analytics';


export function TrafficAttributionCapture() {
    useEffect(() => {
        captureSocialVideoEntryAttribution();
    }, []);

    return null;
}

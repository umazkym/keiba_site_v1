'use client';

import { useEffect } from 'react';

import { captureYouTubeEntryAttribution } from '@/lib/analytics';


export function TrafficAttributionCapture() {
    useEffect(() => {
        captureYouTubeEntryAttribution();
    }, []);

    return null;
}

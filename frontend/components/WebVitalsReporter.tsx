'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { sendWebVitalEvent } from '@/lib/analytics';

const SAMPLE_KEY = 'uma_web_vitals_sample_v1';
const SAMPLE_RATE = 0.2;

const isSampledSession = () => {
    try {
        const saved = window.sessionStorage.getItem(SAMPLE_KEY);
        if (saved === '1') return true;
        if (saved === '0') return false;

        const randomValue = window.crypto?.getRandomValues
            ? window.crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000
            : Math.random();
        const sampled = randomValue < SAMPLE_RATE;
        window.sessionStorage.setItem(SAMPLE_KEY, sampled ? '1' : '0');
        return sampled;
    } catch {
        return false;
    }
};

export function WebVitalsReporter() {
    useReportWebVitals((metric) => {
        if (!isSampledSession()) return;

        sendWebVitalEvent({
            metric_name: metric.name,
            metric_id: metric.id,
            value: metric.name === 'CLS'
                ? Number(metric.value.toFixed(4))
                : Math.round(metric.value),
            rating: metric.rating,
            navigation_type: metric.navigationType,
            release_id:
                process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
                || process.env.NEXT_PUBLIC_APP_RELEASE
                || 'local',
        });
    });

    return null;
}

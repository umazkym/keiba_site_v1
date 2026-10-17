'use client';

import { useEffect } from 'react';
import { useReportWebVitals } from 'next/web-vitals';
import { sendWebVitalEvent } from '@/lib/analytics';

const SAMPLE_KEY = 'uma_web_vitals_sample_v1';
const SAMPLE_RATE = 0.2;

type LayoutShiftSource = { node?: Node | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly };
type LayoutShiftEntry = PerformanceEntry & { value: number; hadRecentInput: boolean; sources?: LayoutShiftSource[] };

// いちばん大きいずれ1回の「動いた要素・縦の動き・その時のスクロール位置」。CLS に添えて送る。
// スマホの CLS が Google のアンカー広告の余白か、こちらの部品かを GA4 で分けるため（2026-10-18）。
let largestShift: { value: number; target: string } | null = null;

const describeShift = (entry: LayoutShiftEntry) => {
    const sources = entry.sources ?? [];
    const source = sources.find((item) => item.node?.nodeType === Node.ELEMENT_NODE) ?? sources[0];
    if (!source) return 'unknown';
    const element = source.node?.nodeType === Node.ELEMENT_NODE ? source.node as Element : null;
    const name = element
        ? `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${Array.from(element.classList).slice(0, 2).map((item) => `.${item}`).join('')}`
        : 'text';
    const moved = Math.round(source.currentRect.y - source.previousRect.y);
    const resized = Math.round(source.currentRect.height - source.previousRect.height);
    return `${name.slice(0, 60)} y${moved >= 0 ? '+' : ''}${moved} h${resized >= 0 ? '+' : ''}${resized} @${Math.round(window.scrollY)}`;
};

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
    useEffect(() => {
        if (typeof PerformanceObserver === 'undefined') return undefined;
        if (!PerformanceObserver.supportedEntryTypes?.includes('layout-shift')) return undefined;
        if (!isSampledSession()) return undefined;

        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as LayoutShiftEntry[]) {
                if (entry.hadRecentInput || entry.value <= (largestShift?.value ?? 0)) continue;
                largestShift = { value: entry.value, target: describeShift(entry) };
            }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
        return () => observer.disconnect();
    }, []);

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
            cls_target: metric.name === 'CLS' && largestShift
                ? `${largestShift.target} v${largestShift.value.toFixed(3)}`
                : undefined,
        });
    });

    return null;
}

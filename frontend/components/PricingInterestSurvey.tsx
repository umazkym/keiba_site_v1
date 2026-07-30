'use client';

import { useEffect, useState } from 'react';
import {
    sendPricingSurveyResponseEvent,
    sendPricingSurveyViewEvent,
} from '@/lib/analytics';


type SurveyResponse = 'use_at_390' | 'consider_by_features' | 'free_only' | 'not_needed';

const STORAGE_KEY = 'uma_data_pricing_survey_v1';
const OPTIONS: Array<{ value: SurveyResponse; label: string }> = [
    { value: 'use_at_390', label: '月390円なら使いたい' },
    { value: 'consider_by_features', label: '機能を見て検討したい' },
    { value: 'free_only', label: '無料版を使いたい' },
    { value: 'not_needed', label: '今は必要ない' },
];

export function PricingInterestSurvey({
    surface,
    eligible,
}: {
    surface: 'my_data' | 'compare';
    eligible: boolean;
}) {
    const [response, setResponse] = useState<SurveyResponse | null>(null);
    const [ready, setReady] = useState(false);
    const enabled = process.env.NEXT_PUBLIC_DATA_PRICING_SURVEY === 'enabled';

    useEffect(() => {
        if (!enabled) return;
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (OPTIONS.some((option) => option.value === stored)) {
            setResponse(stored as SurveyResponse);
        }
        setReady(true);
    }, [enabled]);

    useEffect(() => {
        if (!enabled || !eligible || !ready || response) return;
        const sessionKey = `${STORAGE_KEY}_view_${surface}`;
        if (window.sessionStorage.getItem(sessionKey) === '1') return;
        window.sessionStorage.setItem(sessionKey, '1');
        sendPricingSurveyViewEvent({ surface });
    }, [eligible, enabled, ready, response, surface]);

    if (!enabled || !eligible || !ready) return null;

    if (response) {
        return (
            <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" aria-live="polite">
                <h2 className="text-sm font-black text-slate-900">機能アンケートへの回答</h2>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                    回答ありがとうございます。現時点で申込みや請求は発生していません。
                </p>
            </section>
        );
    }

    return (
        <section className="mt-5 rounded-xl border border-slate-300 bg-white p-4" aria-labelledby={`${surface}-pricing-survey-heading`}>
            <h2 id={`${surface}-pricing-survey-heading`} className="text-base font-black text-slate-950">
                保存・比較をもっと手早くする機能について
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">
                販売前の機能アンケートです。端末間同期、比較セット保存、保存馬の前日メール通知を月390円で提供する場合の意向を教えてください。申込み・請求は発生しません。
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {OPTIONS.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                            window.localStorage.setItem(STORAGE_KEY, option.value);
                            setResponse(option.value);
                            sendPricingSurveyResponseEvent({
                                response: option.value,
                                surface,
                            });
                        }}
                        className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm font-bold text-slate-800 transition-colors duration-150 hover:border-blue-500 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </section>
    );
}

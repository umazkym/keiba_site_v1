'use client';

import { Download } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
    sendPwaInstallPromptViewEvent,
    sendPwaInstallResultEvent,
} from '@/lib/analytics';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function PwaInstallButton() {
    const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [showIosHint, setShowIosHint] = useState(false);
    const promptViewSentRef = useRef(false);
    const installedResultSentRef = useRef(false);

    useEffect(() => {
        const standalone = window.matchMedia('(display-mode: standalone)').matches
            || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
        setIsInstalled(standalone);
        setShowIosHint(
            !standalone
            && /iPad|iPhone|iPod/.test(navigator.userAgent)
        );

        const handleBeforeInstall = (event: Event) => {
            event.preventDefault();
            setInstallPrompt(event as BeforeInstallPromptEvent);
        };
        const handleInstalled = () => {
            setInstallPrompt(null);
            setIsInstalled(true);
            if (!installedResultSentRef.current) {
                installedResultSentRef.current = true;
                sendPwaInstallResultEvent({ surface: 'my_data', result: 'installed' });
            }
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstall);
        window.addEventListener('appinstalled', handleInstalled);
        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
            window.removeEventListener('appinstalled', handleInstalled);
        };
    }, []);

    useEffect(() => {
        const promptType = showIosHint ? 'ios_instruction' : installPrompt ? 'native' : null;
        if (!promptType || promptViewSentRef.current) return;
        promptViewSentRef.current = true;
        sendPwaInstallPromptViewEvent({ surface: 'my_data', prompt_type: promptType });
        if (promptType === 'ios_instruction') {
            sendPwaInstallResultEvent({ surface: 'my_data', result: 'ios_instruction' });
        }
    }, [installPrompt, showIosHint]);

    if (isInstalled) {
        return <span className="text-sm font-bold text-emerald-800">この端末に追加済み</span>;
    }

    if (showIosHint) {
        return (
            <p className="max-w-xs text-xs leading-6 text-slate-600">
                Safariの共有メニューから「ホーム画面に追加」を選ぶと、アプリのように開けます。
            </p>
        );
    }

    if (!installPrompt) return null;

    const install = async () => {
        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        installedResultSentRef.current = true;
        sendPwaInstallResultEvent({ surface: 'my_data', result: choice.outcome });
        if (choice.outcome === 'accepted') {
            setIsInstalled(true);
        }
        setInstallPrompt(null);
    };

    return (
        <button
            type="button"
            onClick={install}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors duration-150 hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
            <Download className="h-4 w-4" aria-hidden="true" />
            ホーム画面に追加
        </button>
    );
}

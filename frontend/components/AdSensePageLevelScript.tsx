'use client';

import { useEffect } from 'react';

type AdSensePageLevelScriptProps = {
    enabled: boolean;
};

const SCRIPT_ID = 'uma-adsense-page-level-script';
const SCRIPT_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';

/**
 * 自動広告・オファーウォール用のページレベルスクリプト。
 *
 * Reactのhydration完了後に読み込み、広告スクリプトが初期HTMLを
 * hydration前に書き換えることによるテキスト不一致を防ぐ。
 */
export const AdSensePageLevelScript = ({ enabled }: AdSensePageLevelScriptProps) => {
    useEffect(() => {
        if (!enabled) return;

        const existingScript =
            document.getElementById(SCRIPT_ID) ||
            document.querySelector(`script[src^="${SCRIPT_SRC}"]`);

        if (existingScript) return;

        const script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.async = true;
        script.src = `${SCRIPT_SRC}?client=ca-pub-4411270831448240`;
        script.crossOrigin = 'anonymous';
        document.head.appendChild(script);
    }, [enabled]);

    return null;
};

'use client'; // Error components must be Client Components

import { useEffect } from 'react';
import Link from 'next/link';
import { GuideHorse } from '@/components/BrandLogo';
import { LineIcon } from '@/components/LineIcon';
import { sendAppErrorViewEvent } from '@/lib/analytics';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);
        // エラー画面が出たことを数える（同じ画面で1回だけ。送る中身は lib/analytics.ts で切りつめる）
        sendAppErrorViewEvent({ error_boundary: 'route', error });
    }, [error]);

    return (
        <div className="mx-auto flex min-h-[60vh] w-full max-w-[560px] flex-col items-center justify-center gap-3 px-4 py-10 text-center">
            <GuideHorse size={120} mood="look" />
            {/* 幅 320px でも1行に収める（22px のままだと最後の1文字だけ次の行に落ちる） */}
            <h1 className="mt-1 text-[length:clamp(18px,5.6vw,22px)] font-bold leading-snug text-slate-900 sm:text-[26px]">ページを表示できませんでした</h1>
            {/* 幅 320px では 14px だと2つ目の文の「い。」だけ次の行に落ちるので、少しだけ小さくする */}
            <p className="text-[length:clamp(13px,4vw,14px)] leading-7 text-slate-700 sm:text-[15px]">
                <span className="inline-block">読み込みの途中で問題が起きました。</span>
                <span className="inline-block">時間をおいて、もう一度お試しください。</span>
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
                <button type="button" onClick={() => reset()} className="ui-btn ui-btn--primary">
                    <LineIcon name="refresh" size={18} />
                    もう一度読み込む
                </button>
                <Link prefetch={false} href="/" className="ui-btn ui-btn--secondary">
                    ホームへ戻る
                </Link>
            </div>
        </div>
    );
}

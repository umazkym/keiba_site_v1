'use client'; // Error components must be Client Components

import { useEffect } from 'react';
import Link from 'next/link';
import { GuideHorse } from '@/components/BrandLogo';
import { LineIcon } from '@/components/LineIcon';

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
    }, [error]);

    return (
        <div className="mx-auto flex min-h-[60vh] w-full max-w-[560px] flex-col items-center justify-center gap-3 px-4 py-10 text-center">
            <GuideHorse size={120} mood="look" />
            <h1 className="mt-1 text-[22px] font-extrabold leading-snug text-slate-900 sm:text-[26px]">ページを表示できませんでした</h1>
            <p className="text-sm leading-7 text-slate-700 sm:text-[15px]">
                読み込みの途中で問題が起きました。時間をおいて、もう一度お試しください。
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
                <button type="button" onClick={() => reset()} className="ui-btn ui-btn--primary">
                    <LineIcon name="refresh" size={18} />
                    もう一度読み込む
                </button>
                <Link href="/" className="ui-btn ui-btn--secondary">
                    ホームへ戻る
                </Link>
            </div>
        </div>
    );
}

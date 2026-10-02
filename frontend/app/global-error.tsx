'use client'; // Error components must be Client Components

import { useEffect } from 'react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // エラー画面が出たことを数える。この画面は落ちないことが最優先なので、
        // gtag があるときだけ、計測の部品を後から読み込んで送る（読めなくても何もしない）。
        try {
            if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
            import('@/lib/analytics')
                .then(({ sendAppErrorViewEvent }) => {
                    sendAppErrorViewEvent({ error_boundary: 'global', error });
                })
                .catch(() => {
                    // 何もしない
                });
        } catch {
            // 何もしない
        }
    }, [error]);

    return (
        <html lang="ja">
            <body>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    padding: '0 16px',
                    textAlign: 'center',
                    color: '#151A3D',
                    backgroundColor: '#F3F5FA',
                    fontFamily: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", "Meiryo", system-ui, sans-serif'
                }}>
                    {/* 幅 320px でも1行に収める（22px のままだと最後の1文字だけ次の行に落ちる） */}
                    <h2 style={{ margin: 0, fontSize: 'clamp(18px, 5.6vw, 22px)', lineHeight: 1.4 }}>ページを表示できませんでした</h2>
                    <p style={{ margin: '12px 0 0', fontSize: '14px', lineHeight: 2 }}>
                        <span style={{ display: 'inline-block' }}>読み込みの途中で問題が起きました。</span>
                        <span style={{ display: 'inline-block' }}>時間をおいて、もう一度お試しください。</span>
                    </p>
                    <button
                        onClick={() => reset()}
                        style={{
                            marginTop: '20px',
                            minHeight: '44px',
                            padding: '0 20px',
                            backgroundColor: '#4C4EFF',
                            color: 'white',
                            border: 'none',
                            borderRadius: '11px',
                            fontWeight: 700,
                            fontSize: '15px',
                            cursor: 'pointer'
                        }}
                    >
                        もう一度読み込む
                    </button>
                </div>
            </body>
        </html>
    );
}

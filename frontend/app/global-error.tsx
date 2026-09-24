'use client'; // Error components must be Client Components

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
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
                    <h2>重大なシステムエラーが発生しました</h2>
                    <p>申し訳ありません。現在システムを復旧中です。</p>
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
                        再読み込み
                    </button>
                </div>
            </body>
        </html>
    );
}

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
                    fontFamily: 'system-ui, sans-serif'
                }}>
                    <h2>重大なシステムエラーが発生しました</h2>
                    <p>申し訳ありません。現在システムを復旧中です。</p>
                    <button
                        onClick={() => reset()}
                        style={{
                            marginTop: '20px',
                            padding: '10px 20px',
                            backgroundColor: '#0A1128',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
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

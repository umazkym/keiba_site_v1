import { Metadata } from 'next';

export const metadata: Metadata = {
    title: '運営者情報・このサイトについて | UMA-FREE',
    description: 'UMA-FREEの運営者情報とサービス内容について詳しく説明しています。AI競馬予測の仕組みやサイトの目的、技術情報などを公開しています。',
    robots: {
        index: true,
        follow: true,
    },
    openGraph: {
        title: '運営者情報・このサイトについて | UMA-FREE',
        description: 'UMA-FREEの運営者情報とサービス内容について詳しく説明しています。',
        url: 'https://uma-free.com/about',
        siteName: 'UMA-FREE',
        locale: 'ja_JP',
        type: 'website',
    },
    alternates: {
        canonical: 'https://uma-free.com/about',
    },
};

export default function AboutPage() {
    return (
        <div className="container mx-auto my-10 px-4">
            <div className="max-w-4xl mx-auto bg-white p-6 md:p-8 rounded-lg shadow-md border">
                <div className="prose prose-gray max-w-none">
                    <h1>このサイトについて</h1>
                    <p>
                        UMA-FREEは、個人開発者が運営する、独自のAIアルゴリズムを用いた競馬予想サイトです。中央競馬（JRA）および地方競馬（NAR）の全レースを対象に、全てのAI予測データを完全無料で公開しています。会員登録やメールアドレスの登録は一切不要です。
                    </p>
                    <p>
                        本サイトが、皆様の競馬予想に新しい視点やデータに基づいた楽しみ方をもたらすきっかけの一つになれば幸いです。
                    </p>
                    
                    <section>
                        <h2>運営者情報</h2>
                        <dl>
                            <dt>サイト名</dt>
                            <dd>UMA-FREE</dd>
                            <dt>運営者</dt>
                            <dd>おとうふや</dd>
                            <dt>サービス開始日</dt>
                            <dd>2025年9月11日</dd>
                            <dt>お問い合わせ</dt>
                            <dd><a href="/contact">お問い合わせフォーム</a>をご利用ください。</dd>
                        </dl>
                    </section>

                    <section>
                        <h2>公開データについて</h2>
                        <div>
                            <h3>全出走馬のAI偏差値</h3>
                            <p>AIによる能力評価を偏差値として数値化したものです。過去のレースタイムや着順、コース適性などを総合的に判断しています。</p>
                        </div>
                        <div>
                            <h3>AIスタート位置取り予測</h3>
                            <p>各馬の脚質や過去のレース展開データから、スタート直後の位置取りを予測します。逃げ・先行馬を探す際に役立ちます。</p>
                        </div>
                        <div>
                            <h3>過去対決データ</h3>
                            <p>出走馬同士が過去に同じレースで直接対決した際の成績を一覧で確認できます。馬同士の力関係を比較するのに便利です。</p>
                        </div>
                        <div>
                            <h3>枠順傾向スコア</h3>
                            <p>過去の膨大なレース結果から、コースや距離に応じた枠順の有利・不利をスコア化した独自のデータです。</p>
                        </div>
                    </section>

                    <section>
                        <h2>技術情報</h2>
                        <p>本サービスは、以下の技術を活用して構築・運営されています：</p>
                        <ul>
                            <li><strong>AI/機械学習：</strong>Python, scikit-learn, pandas</li>
                            <li><strong>フロントエンド：</strong>Next.js, React, TypeScript, Tailwind CSS</li>
                            <li><strong>バックエンド：</strong>FastAPI, PostgreSQL</li>
                            <li><strong>インフラ：</strong>Vercel, Render</li>
                        </ul>
                    </section>
                </div>
            </div>
        </div>
    );
}
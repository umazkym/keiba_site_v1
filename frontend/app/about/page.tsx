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
                <div className="flex flex-col gap-10">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 mb-4 border-b pb-4">このサイトについて</h1>
                        <p className="text-gray-700 leading-relaxed">UMA-FREEは、個人開発者が運営する、独自のAIアルゴリズムを用いた競馬予想サイトです。中央競馬（JRA）および地方競馬（NAR）の全レースを対象に、全てのAI予測データを完全無料で公開しています。会員登録やメールアドレスの登録は一切不要です。</p>
                        <p className="text-gray-700 mt-4 leading-relaxed">本サイトが、皆様の競馬予想に新しい視点やデータに基づいた楽しみ方をもたらすきっかけの一つになれば幸いです。</p>
                    </div><section>
                        <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-3">運営者情報</h2>
                        <dl className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-x-4">
                                <dt className="font-semibold text-gray-700">サイト名</dt>
                                <dd className="sm:col-span-3 text-gray-800">UMA-FREE</dd>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-x-4">
                                <dt className="font-semibold text-gray-700">運営者</dt>
                                <dd className="sm:col-span-3 text-gray-800">おとうふや</dd>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-x-4">
                                <dt className="font-semibold text-gray-700">サービス開始日</dt>
                                <dd className="sm:col-span-3 text-gray-800">2025年9月11日</dd>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-x-4">
                                <dt className="font-semibold text-gray-700">お問い合わせ</dt>
                                <dd className="sm:col-span-3">
                                    <a href="/contact" className="text-blue-600 hover:underline">お問い合わせフォーム</a>をご利用ください。
                                </dd>
                            </div>
                        </dl>
                    </section><section>
                        <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-3">公開データについて</h2>
                        <div className="space-y-6">
                            <div>
                                <h3 className="font-semibold text-gray-800 text-lg">全出走馬のAI偏差値</h3>
                                <p className="text-gray-700 mt-1">AIによる能力評価を偏差値として数値化したものです。過去のレースタイムや着順、コース適性などを総合的に判断しています。</p>
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-800 text-lg">AIスタート位置取り予測</h3>
                                <p className="text-gray-700 mt-1">各馬の脚質や過去のレース展開データから、スタート直後の位置取りを予測します。逃げ・先行馬を探す際に役立ちます。</p>
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-800 text-lg">過去対決データ</h3>
                                <p className="text-gray-700 mt-1">出走馬同士が過去に同じレースで直接対決した際の成績を一覧で確認できます。馬同士の力関係を比較するのに便利です。</p>
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-800 text-lg">枠順傾向スコア</h3>
                                <p className="text-gray-700 mt-1">過去の膨大なレース結果から、コースや距離に応じた枠順の有利・不利をスコア化した独自のデータです。</p>
                            </div>
                        </div>
                    </section><section>
                        <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-3">技術情報</h2>
                        <p className="text-gray-700 mb-4">本サービスは、以下の技術を活用して構築・運営されています：</p>
                        <ul className="list-disc list-inside space-y-2 text-gray-700">
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
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: '運営者情報・このサイトについて | UMA-FREE',
    description: 'UMA-FREEの運営者情報とサービス内容について詳しく説明しています。',
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
                    <div className="mb-10">
                        <h1 className="text-3xl font-bold text-gray-800 mb-4 border-b pb-4">このサイトについて</h1>
                        <p className="text-gray-700">
                            個人運営による、独自のAIを用いた競馬予想サイトです。中央・地方の全レースを対象に、全てのデータを無料で公開しています。登録は不要です。
                        </p>
                        <p className="text-gray-700 mt-4">
                            本サイトが、皆様の競馬予想に新しい視点や楽しみ方をもたらすきっかけの一つになればうれしいです。
                        </p>
                    </div>

                    <section className="mb-10">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-3">運営者情報</h2>
                            <div className="flex flex-col sm:flex-row sm:items-baseline">
                                <dt className="font-semibold text-gray-700 sm:w-1/4">サイト名</dt>
                                <dd className="mt-1 sm:mt-0 sm:w-3/4">UMA-FREE</dd>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-baseline">
                                <dt className="font-semibold text-gray-700 sm:w-1/4">運営者</dt>
                                <dd className="mt-1 sm:mt-0 sm:w-3/4">おとうふや</dd>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-baseline">
                                <dt className="font-semibold text-gray-700 sm:w-1/4">サービス開始日</dt>
                                <dd className="mt-1 sm:mt-0 sm:w-3/4">2025年9月11日</dd>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-baseline">
                                <dt className="font-semibold text-gray-700 sm:w-1/4">お問い合わせ</dt>
                                <dd className="mt-1 sm:mt-0 sm:w-3/4">
                                    <a href="/contact" className="text-blue-600 hover:underline">お問い合わせフォーム</a>
                                </dd>
                            </div>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-3">公開データについて</h2>
                        <div className="space-y-5 text-gray-700">
                            <div>
                                <h3 className="font-semibold">全出走馬のAI偏差値</h3>
                                <p>AIによる能力評価を偏差値として数値化したものです。</p>
                            </div>
                            <div>
                                <h3 className="font-semibold">AIスタート位置取り予測</h3>
                                <p>脚質や過去データから、スタート直後の位置取りを予測します。</p>
                            </div>
                            <div>
                                <h3 className="font-semibold">過去対決データ</h3>
                                <p>出走馬同士の過去の対戦成績です。</p>
                            </div>
                            <div>
                                <h3 className="font-semibold">枠順傾向スコア</h3>
                                <p>過去レースの成績から、コースや距離に応じた枠順の有利・不利をスコア化したものです。</p>
                            </div>
                        </div>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-3">重要事項・免責事項</h2>
                        <div className="space-y-5 text-gray-700">
                            <div>
                                <h3 className="font-bold text-lg mb-2">ご利用にあたって</h3>
                                <ul className="list-disc list-inside space-y-2">
                                    <li>本サービスは20歳以上の方を対象としています</li>
                                    <li>提供する情報は参考情報であり、的中を保証するものではありません</li>
                                    <li>最終的な馬券購入の判断はお客様ご自身の責任で行ってください</li>
                                    <li>本サービスの情報に基づく損害について、運営者は責任を負いません</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-bold text-lg mb-2">ギャンブル依存症について</h3>
                                <p className="mb-2">
                                    馬券の購入は適度に楽しむ遊びです。のめり込みにはご注意ください。
                                </p>
                                <p>
                                    <strong>相談窓口：</strong><br />
                                    ギャンブル依存症予防回復支援センター<br />
                                    TEL: 0120-683-705（年中無休）
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-3">技術情報</h2>
                        <div className="space-y-5 text-gray-700">
                            <p>本サービスは、以下の技術を活用して構築されています：</p>
                            <ul className="list-disc list-inside space-y-2">
                                <li><strong>AI/機械学習：</strong>Python, scikit-learn, pandas</li>
                                <li><strong>フロントエンド：</strong>Next.js, React, TypeScript, Tailwind CSS</li>
                                <li><strong>バックエンド：</strong>FastAPI, PostgreSQL</li>
                                <li><strong>インフラ：</strong>Vercel, Render</li>
                            </ul>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

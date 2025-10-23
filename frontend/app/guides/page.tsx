import Link from 'next/link';
import { getAllGuides } from '../../lib/guides';
import { getTodayString } from '../../lib/date-utils';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'ガイド一覧 | UMA-FREE - 競馬予想ガイド・知識習得',
    description: '競馬初心者から上級者まで必読のガイド集。基本用語からAI予測手法、全競馬場ガイド、騎手解説、配当の読み方など、競馬予想に必要なすべての知識が揃っています。',
    keywords: [
        '競馬ガイド',
        '競馬用語',
        '競馬初心者',
        '競馬予想',
        'AI予測',
        '馬券',
        '競馬知識',
    ],
    alternates: {
        canonical: '/guides',
    },
    openGraph: {
        title: 'ガイド一覧 | UMA-FREE',
        description: '競馬予想に必要なすべての知識が揃ったガイド集',
        url: '/guides',
        type: 'website',
    },
};

// ▼▼▼▼▼【ここから修正】ガイドページ用の静的テキストを定義 ▼▼▼▼▼
const content = {
    title: 'ガイド一覧',
    subtitle: '競馬予想に必要な知識をすべて習得',
    description: 'UMA-FREEの高精度なAI予想をさらに活かすため、競馬の基本から応用までを網羅したガイド集です。初心者から上級者まで、誰もが必読の内容が揃っています。',
    categoryLabel: 'ガイドカテゴリー',
};
// ▲▲▲▲▲【修正ここまで】▲▲▲▲▲

export default async function GuidesPage() {
    const allGuides = getAllGuides();
    const todayStr = getTodayString();

    // ガイドを表示順にソート
    const guideOrder = [
        'horseracing-basics',
        'prediction-glossary',
        'course-guide',
        'jockey-guide',
        'odds-reading-guide',
    ];

    const sortedGuides = allGuides.sort((a, b) => {
        const aIndex = guideOrder.indexOf(a.slug);
        const bIndex = guideOrder.indexOf(b.slug);
        return (aIndex === -1 ? Infinity : aIndex) - (bIndex === -1 ? Infinity : bIndex);
    });

    return (
        <div className="flex flex-col gap-12 py-12 px-4">
            {/* ヘッダーセクション */}
            <div className="flex flex-col gap-6 max-w-3xl mx-auto text-center">
                <h1 className="text-5xl font-bold text-gray-800">{content.title}</h1>
                <h2 className="text-2xl text-gray-600">{content.subtitle}</h2>
                <p className="text-lg text-gray-700 leading-relaxed">{content.description}</p>
            </div>

            {/* ガイドカード グリッド */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-6xl mx-auto">
                {sortedGuides.map((guide) => (
                    <Link
                        href={`/guides/${guide.slug}`}
                        key={guide.slug}
                        className="flex flex-col gap-4 p-6 border border-gray-200 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 bg-white hover:translate-y-[-4px]"
                    >
                        {/* ガイドカテゴリーバッジ */}
                        <span className="inline-block w-fit bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full">
                            {guide.category}
                        </span>

                        {/* ガイドタイトル */}
                        <h3 className="text-xl font-bold text-gray-800 line-clamp-2">{guide.title}</h3>

                        {/* ガイド説明 */}
                        <p className="text-gray-600 text-sm leading-relaxed line-clamp-3">
                            {guide.description}
                        </p>

                        {/* キーワードタグ */}
                        {guide.keywords && guide.keywords.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {guide.keywords.slice(0, 3).map((keyword) => (
                                    <span
                                        key={keyword}
                                        className="inline-block bg-green-50 text-green-700 text-xs px-2 py-1 rounded"
                                    >
                                        {keyword}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* 読む時間の目安 */}
                        <p className="text-xs text-gray-500 mt-auto">
                            📖 約{Math.ceil(guide.content.length / 400)}分で読める
                        </p>
                    </Link>
                ))}
            </div>

            {/* CTA セクション */}
            <div className="bg-gradient-to-br from-indigo-50 via-white to-blue-50 border-2 border-primary/20 p-8 rounded-xl max-w-3xl mx-auto text-center w-full shadow-lg">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-3">ガイドを読んだら、AI予想を試してみましょう</h2>
                    <p className="text-gray-600 leading-relaxed">
                        このガイドで学んだ知識と、UMA-FREEの高精度なAI予想を組み合わせることで、競馬予想の成功率がさらに向上します。
                    </p>
                </div>
                <Link
                    href={`/races/${todayStr}`}
                    className="inline-block bg-primary hover:bg-primary-dark text-white hover:text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-all duration-300 ease-in-out hover:shadow-xl hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-light"
                >
                    今日のレース予想を見る
                </Link>
            </div>

            {/* FAQ セクション */}
            <div className="max-w-3xl mx-auto w-full">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">よくある質問</h2>
                <div className="space-y-3">
                    <details className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                        <summary className="font-bold text-gray-800 flex items-center justify-between hover:text-primary transition-colors">
                            <span>ガイドはすべて無料で読めますか？</span>
                            <span className="text-primary text-lg">▼</span>
                        </summary>
                        <p className="mt-3 text-gray-600 leading-relaxed">はい、すべてのガイドは完全無料で読むことができます。登録も不要です。</p>
                    </details>
                    <details className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                        <summary className="font-bold text-gray-800 flex items-center justify-between hover:text-primary transition-colors">
                            <span>競馬初心者でも理解できますか？</span>
                            <span className="text-primary text-lg">▼</span>
                        </summary>
                        <p className="mt-3 text-gray-600 leading-relaxed">
                            はい、すべてのガイドは初心者向けに丁寧に説明されています。まず「競馬の基本用語集」からお読みください。
                        </p>
                    </details>
                    <details className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                        <summary className="font-bold text-gray-800 flex items-center justify-between hover:text-primary transition-colors">
                            <span>ガイドはどのくらいの頻度で更新されますか？</span>
                            <span className="text-primary text-lg">▼</span>
                        </summary>
                        <p className="mt-3 text-gray-600 leading-relaxed">
                            ガイドは随時更新されます。競馬データや予想手法の最新情報を反映しています。
                        </p>
                    </details>
                    <details className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                        <summary className="font-bold text-gray-800 flex items-center justify-between hover:text-primary transition-colors">
                            <span>ガイド以外に相談できる場所はありますか？</span>
                            <span className="text-primary text-lg">▼</span>
                        </summary>
                        <p className="mt-3 text-gray-600 leading-relaxed">
                            ご不明な点やご質問は、<Link href="/contact" className="text-primary hover:underline">お問い合わせフォーム</Link>からお気軽にお尋ねください。
                        </p>
                    </details>
                </div>
            </div>
        </div>
    );
}

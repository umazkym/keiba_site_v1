import { getGuideBySlug, getAllGuideSlugs } from '../../../lib/guides';
import { getTodayString } from '../../../lib/date-utils';
import type { Metadata } from 'next';
import Link from 'next/link';

interface GuidePageProps {
    params: {
        slug: string;
    };
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
    const guide = await getGuideBySlug(params.slug);

    return {
        title: `${guide.title} | UMA-FREE`,
        description: guide.description,
        keywords: guide.keywords,
        alternates: {
            canonical: `/guides/${params.slug}`,
        },
        openGraph: {
            title: guide.title,
            description: guide.description,
            url: `/guides/${params.slug}`,
            type: 'article',
            images: [
                {
                    url: guide.eyecatch,
                    width: 1200,
                    height: 630,
                    alt: guide.title,
                },
            ],
        },
    };
}

export async function generateStaticParams() {
    const slugs = getAllGuideSlugs();
    return slugs;
}

export default async function GuidePage({ params }: GuidePageProps) {
    const guide = await getGuideBySlug(params.slug);
    const todayStr = getTodayString();

    return (
        <div className="bg-gray-50 py-12">
            <div className="container mx-auto px-4 max-w-4xl">
                {/* ガイドコンテンツ */}
                <article className="bg-white p-6 sm:p-8 rounded-lg shadow-sm mb-8">
                    {/* ヘッダー */}
                    <header className="mb-8 text-center border-b pb-6">
                        <nav className="text-sm text-gray-600 mb-4">
                            <Link href="/guides" className="hover:text-primary hover:underline">
                                ガイド一覧
                            </Link>
                            {' > '}
                            <span className="text-gray-800">{guide.title}</span>
                        </nav>
                        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-800 mb-3">{guide.title}</h1>
                        <p className="text-lg text-gray-600 leading-relaxed">{guide.description}</p>
                        {guide.keywords && guide.keywords.length > 0 && (
                            <div className="flex flex-wrap gap-2 justify-center mt-4">
                                {guide.keywords.map((keyword) => (
                                    <span key={keyword} className="inline-block bg-green-50 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
                                        {keyword}
                                    </span>
                                ))}
                            </div>
                        )}
                    </header>

                    {/* ガイド本文 */}
                    <div
                        className="prose max-w-none text-gray-700 leading-relaxed space-y-6"
                        dangerouslySetInnerHTML={{ __html: guide.content }}
                    />
                </article>

                {/* 関連ガイドへのナビゲーション */}
                <div className="bg-white p-6 sm:p-8 rounded-lg shadow-sm mb-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-3">関連ガイド</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Link href="/guides/horseracing-basics" className="flex flex-col gap-2 p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow hover:translate-y-[-2px]">
                            <h3 className="font-bold text-gray-800">競馬の基本用語集</h3>
                            <p className="text-sm text-gray-600">競馬初心者向けの必須用語解説</p>
                        </Link>
                        <Link href="/guides/prediction-glossary" className="flex flex-col gap-2 p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow hover:translate-y-[-2px]">
                            <h3 className="font-bold text-gray-800">AI予測用語集</h3>
                            <p className="text-sm text-gray-600">AI予想特有の用語と分析手法</p>
                        </Link>
                        <Link href="/guides/course-guide" className="flex flex-col gap-2 p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow hover:translate-y-[-2px]">
                            <h3 className="font-bold text-gray-800">全競馬場ガイド</h3>
                            <p className="text-sm text-gray-600">各競馬場の特性と有効な予想手法</p>
                        </Link>
                        <Link href="/guides/jockey-guide" className="flex flex-col gap-2 p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow hover:translate-y-[-2px]">
                            <h3 className="font-bold text-gray-800">主要騎手解説</h3>
                            <p className="text-sm text-gray-600">一流騎手の特性と過去成績</p>
                        </Link>
                        <Link href="/guides/odds-reading-guide" className="flex flex-col gap-2 p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow hover:translate-y-[-2px]">
                            <h3 className="font-bold text-gray-800">配当の読み方</h3>
                            <p className="text-sm text-gray-600">配当から読み取る馬券戦略</p>
                        </Link>
                    </div>
                </div>

                {/* CTA セクション */}
                <div className="bg-blue-50 border-2 border-primary/20 p-8 rounded-lg text-center shadow-sm mb-8">
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-gray-800 mb-3">このガイドで学んだ知識を活かしましょう</h2>
                        <p className="text-gray-600 leading-relaxed max-w-2xl mx-auto">
                            UMA-FREEの高精度なAI予想と組み合わせることで、競馬予想の精度がさらに向上します。
                        </p>
                    </div>
                    <Link
                        href={`/races/${todayStr}`}
                        className="inline-block bg-primary hover:bg-primary-dark text-white hover:text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all duration-300 ease-in-out hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-light"
                    >
                        今日のレース予想を見る
                    </Link>
                </div>

                {/* 戻るボタン */}
                <div className="text-center">
                    <Link href="/guides" className="bg-gray-800 text-white font-bold py-3 px-8 rounded-lg hover:bg-gray-700 transition-colors">
                        ガイド一覧へ戻る
                    </Link>
                </div>
            </div>
        </div>
    );
}

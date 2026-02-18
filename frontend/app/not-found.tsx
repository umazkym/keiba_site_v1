// frontend/app/not-found.tsx
import Link from "next/link";
import { SearchIcon } from "@/components/Icons";
import type { Metadata } from 'next';

// 404ページはインデックスさせない
export const metadata: Metadata = {
    robots: {
        index: false,
        follow: true,
    },
};

export default function NotFound() {
    return (
        <div className="py-8 space-y-10">
            <div className="max-w-4xl mx-auto">
                {/* エラーメッセージ - ヒーロースタイル */}
                <section className="text-center p-8 md:p-12 bg-gray-50 rounded-lg border border-gray-200">
                    <h1 className="text-5xl md:text-6xl font-extrabold text-primary-dark mb-3">
                        404
                    </h1>
                    <p className="text-2xl md:text-3xl font-bold text-gray-800 mb-4">
                        ページが見つかりません
                    </p>
                    <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto">
                        お探しのページは存在しないか、移動した可能性があります。<br className="hidden sm:block" />
                        下記のリンクから目的のページをお探しください。
                    </p>
                </section>


                {/* ナビゲーションカード */}
                <div className="grid md:grid-cols-2 gap-6 my-10">
                    {/* トップページ */}
                    <Link
                        href="/"
                        className="bg-white rounded-lg border border-gray-200 p-6 hover:border-primary transition-colors group"
                    >
                        <div className="flex items-start gap-4">
                            <div className="bg-primary-light/10 text-primary rounded-lg p-4 flex-shrink-0 group-hover:bg-primary-light/20 transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-gray-800 mb-1 group-hover:text-primary transition-colors">トップページ</h3>
                                <p className="text-sm text-gray-600">最新のデータ分析情報と注目馬をチェック</p>
                            </div>
                        </div>
                    </Link>

                    {/* 検索 */}
                    <Link
                        href="/search"
                        className="bg-white rounded-lg border border-gray-200 p-6 hover:border-accent transition-colors group"
                    >
                        <div className="flex items-start gap-4">
                            <div className="bg-accent-light/10 text-accent rounded-lg p-4 flex-shrink-0 group-hover:bg-accent-light/20 transition-colors">
                                <SearchIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-gray-800 mb-1 group-hover:text-accent transition-colors">サイト内検索</h3>
                                <p className="text-sm text-gray-600">キーワードから情報を検索</p>
                            </div>
                        </div>
                    </Link>

                    {/* よくある質問 */}
                    <Link
                        href="/faq"
                        className="bg-white rounded-lg border border-gray-200 p-6 hover:border-green-600 transition-colors group"
                    >
                        <div className="flex items-start gap-4">
                            <div className="bg-green-50 text-green-600 rounded-lg p-4 flex-shrink-0 group-hover:bg-green-100 transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-gray-800 mb-1 group-hover:text-green-600 transition-colors">よくある質問</h3>
                                <p className="text-sm text-gray-600">よくあるご質問と回答をチェック</p>
                            </div>
                        </div>
                    </Link>

                    {/* お問い合わせ */}
                    <Link
                        href="/contact"
                        className="bg-white rounded-lg border border-gray-200 p-6 hover:border-blue-600 transition-colors group"
                    >
                        <div className="flex items-start gap-4">
                            <div className="bg-blue-50 text-blue-600 rounded-lg p-4 flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-gray-800 mb-1 group-hover:text-blue-600 transition-colors">お問い合わせ</h3>
                                <p className="text-sm text-gray-600">ご質問や問題をご報告ください</p>
                            </div>
                        </div>
                    </Link>
                </div>

                {/* 主要ページリンク */}
                <section className="bg-gray-50 rounded-lg border border-gray-200 p-8">
                    <h2 className="font-bold text-lg text-gray-800 mb-6 text-center">その他の主要ページ</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <Link href="/articles" className="text-primary hover:text-primary-dark font-semibold text-center py-3 px-2 rounded-lg hover:bg-white transition-colors">
                            分析記事
                        </Link>
                        <Link href="/about" className="text-primary hover:text-primary-dark font-semibold text-center py-3 px-2 rounded-lg hover:bg-white transition-colors">
                            運営者情報
                        </Link>
                        <Link href="/advertising" className="text-primary hover:text-primary-dark font-semibold text-center py-3 px-2 rounded-lg hover:bg-white transition-colors">
                            広告について
                        </Link>
                        <Link href="/privacy" className="text-primary hover:text-primary-dark font-semibold text-center py-3 px-2 rounded-lg hover:bg-white transition-colors">
                            プライバシーポリシー
                        </Link>
                        <Link href="/terms" className="text-primary hover:text-primary-dark font-semibold text-center py-3 px-2 rounded-lg hover:bg-white transition-colors">
                            利用規約
                        </Link>
                        <Link href="/faq" className="text-primary hover:text-primary-dark font-semibold text-center py-3 px-2 rounded-lg hover:bg-white transition-colors">
                            よくある質問
                        </Link>
                    </div>
                </section>
            </div>
        </div>
    );
}

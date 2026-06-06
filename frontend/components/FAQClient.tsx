'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AdUnit } from './AdUnit';
import { faqItems } from '@/lib/faq-content';

// カテゴリ別カラーマップ (Modern Slate/Gray tones)
const categoryColorMap: Record<string, { badge: string; border: string }> = {
    'サービス全般': { badge: 'bg-slate-100 text-slate-700', border: 'border-slate-300' },
    'データ分析': { badge: 'bg-emerald-50 text-emerald-700', border: 'border-emerald-300' },
    '馬券購入': { badge: 'bg-amber-50 text-amber-700', border: 'border-amber-300' },
    'トラブルシューティング': { badge: 'bg-rose-50 text-rose-700', border: 'border-rose-300' },
};

const getCategoryColor = (category: string) =>
    categoryColorMap[category] || { badge: 'bg-gray-100 text-gray-700', border: 'border-gray-300' };

export const FAQClient = () => {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const categories = [...new Set(faqItems.map(item => item.category))];

    const filteredItems = selectedCategory
        ? faqItems.filter(item => item.category === selectedCategory)
        : faqItems;

    return (
        <div className="py-10 sm:py-16 px-4">
                <div className="max-w-[800px] mx-auto w-full">
                    {/* ヘッダー */}
                    <div className="text-center mb-10 sm:mb-14">
                        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4 sm:mb-6 tracking-tight">
                            よくある質問
                        </h1>
                        <p className="text-base text-text-secondary leading-relaxed mx-auto">
                            UMA-FREEに関するご質問にお答えします。見つからない場合は、
                            <Link href="/contact" className="text-primary hover:text-primary-dark font-bold underline decoration-2 decoration-primary/30 hover:decoration-primary transition-all ml-1">
                                お問い合わせ
                            </Link>
                            ください。
                        </p>
                    </div>

                    {/* カテゴリフィルタ */}
                    <div className="mb-10 flex flex-wrap gap-2">
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className={`px-4 py-2 rounded-full font-bold text-sm transition-all duration-200 ${selectedCategory === null
                                ? 'bg-primary text-white shadow-md'
                                : 'bg-white text-text-secondary border border-border hover:bg-slate-50 hover:border-slate-300'
                                }`}
                        >
                            すべて
                        </button>
                        {categories.map(category => (
                            <button
                                key={category}
                                onClick={() => setSelectedCategory(category)}
                                className={`px-4 py-2 rounded-full font-bold text-sm transition-all duration-200 ${selectedCategory === category
                                    ? 'bg-primary text-white shadow-md'
                                    : 'bg-white text-text-secondary border border-border hover:bg-slate-50 hover:border-slate-300'
                                    }`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>

                    {/* FAQ アイテム */}
                    <div className="space-y-6">
                        {filteredItems.map((item, index) => {
                            const colors = getCategoryColor(item.category);
                            return (
                                <div key={item.id}>
                                    <div className="bg-white p-6 rounded-xl border border-border shadow-sm">
                                        <div className="flex items-start gap-2 mb-3">
                                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 tracking-wide ${colors.badge}`}>
                                                {item.category}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-primary mb-3 text-lg flex items-start gap-2">
                                            <span className="text-slate-300" aria-hidden="true">Q.</span>
                                            {item.question}
                                        </h3>
                                        <div className="text-text-secondary leading-relaxed text-sm flex items-start gap-2">
                                            <span className="font-bold text-primary opacity-20" aria-hidden="true">A.</span>
                                            <div className="flex-1">
                                                {item.answer}
                                            </div>
                                        </div>
                                    </div>
                                    {/* カテゴリ間にインフィード広告を挿入（8問目の後、フィルタ無し時のみ） */}
                                    {index === 7 && !selectedCategory && (
                                        <div className="mt-6">
                                            <AdUnit slot="8529703346" placement="inline" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* 追加ヘルプ */}
                    <div className="mt-16 bg-surface p-8 rounded-2xl text-center border border-border">
                        <p className="text-text-primary font-bold mb-2 text-lg">
                            解決しませんでしたか？
                        </p>
                        <p className="text-text-secondary mb-6 text-sm">
                            その他のご質問やご不明な点がございましたら、遠慮なくお問い合わせください。
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link
                                href="/contact"
                                className="inline-flex items-center justify-center bg-primary hover:bg-primary-light text-white font-bold py-3 px-8 rounded-full transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                            >
                                お問い合わせ
                            </Link>
                            <Link
                                href="/articles"
                                className="inline-flex items-center justify-center bg-white border border-border text-text-secondary hover:text-primary hover:border-primary font-bold py-3 px-8 rounded-full transition-all duration-200 hover:shadow-md"
                            >
                                記事を読む
                            </Link>
                        </div>
                    </div>
                </div>
        </div>
    );
};

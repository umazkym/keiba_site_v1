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
        <div className="py-4 sm:py-16 px-2.5 sm:px-4">
            <div className="max-w-[800px] mx-auto w-full">
                {/* ヘッダー */}
                <div className="text-center mb-4 sm:mb-14">
                    <h1 className="text-xl sm:text-4xl font-bold text-text-primary mb-1.5 sm:mb-6 tracking-tight">
                        よくある質問
                    </h1>
                    <p className="text-xs sm:text-base text-text-secondary leading-normal sm:leading-relaxed mx-auto">
                        UMA-FREEに関するご質問にお答えします。
                    </p>
                </div>

                {/* カテゴリフィルタ */}
                <div className="mb-4 flex flex-wrap gap-1.5">
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className={`px-2.5 py-1 sm:px-4 sm:py-2 rounded-full font-bold text-xs sm:text-sm transition-all duration-200 ${selectedCategory === null
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
                            className={`px-2.5 py-1 sm:px-4 sm:py-2 rounded-full font-bold text-xs sm:text-sm transition-all duration-200 ${selectedCategory === category
                                ? 'bg-primary text-white shadow-md'
                                : 'bg-white text-text-secondary border border-border hover:bg-slate-50 hover:border-slate-300'
                                }`}
                        >
                            {category}
                        </button>
                    ))}
                </div>

                {/* FAQ アイテム */}
                <div className="space-y-2.5 sm:space-y-6">
                    {filteredItems.map((item, index) => {
                        const colors = getCategoryColor(item.category);
                        return (
                            <div key={item.id}>
                                <div className="bg-white p-3 sm:p-6 rounded-xl border border-border shadow-sm">
                                    <div className="flex items-start gap-2 mb-1.5">
                                        <span className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 tracking-wide ${colors.badge}`}>
                                            {item.category}
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-primary mb-2 text-sm sm:text-lg flex items-start gap-2">
                                        <span className="text-slate-400 shrink-0" aria-hidden="true">Q.</span>
                                        <span>{item.question}</span>
                                    </h3>
                                    <div className="text-text-secondary leading-normal text-xs sm:text-sm flex items-start gap-2">
                                        <span className="font-bold text-primary opacity-30 shrink-0" aria-hidden="true">A.</span>
                                        <div className="flex-1">
                                            {item.answer}
                                        </div>
                                    </div>
                                </div>
                                {/* カテゴリ間にインフィード広告を挿入（8問目の後、フィルタ無し時のみ） */}
                                {index === 7 && !selectedCategory && (
                                    <div className="mt-4 sm:mt-6">
                                        <AdUnit slot="8529703346" placement="inline" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* 追加ヘルプ */}
                <div className="mt-6 sm:mt-16 bg-surface p-4 sm:p-8 rounded-2xl text-center border border-border">
                    <p className="text-text-primary font-bold mb-1 text-sm sm:text-lg">
                        解決しませんでしたか？
                    </p>
                    <p className="text-text-secondary mb-4 text-xs sm:text-sm">
                        その他のご質問やご不明な点がございましたら、遠慮なくお問い合わせください。
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
                        <Link
                            href="/contact"
                            className="inline-flex items-center justify-center bg-primary hover:bg-primary-light text-white font-bold py-2.5 px-6 rounded-full text-xs sm:text-sm transition-all duration-200 shadow-md"
                        >
                            お問い合わせ
                        </Link>
                        <Link
                            href="/articles"
                            className="inline-flex items-center justify-center bg-white border border-border text-text-secondary hover:text-primary hover:border-primary font-bold py-2.5 px-6 rounded-full text-xs sm:text-sm transition-all duration-200"
                        >
                            記事を読む
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

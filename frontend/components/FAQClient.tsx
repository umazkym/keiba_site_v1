'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AdUnit } from './AdUnit';
import { GuideHorse } from '@/components/BrandLogo';
import { LineIcon } from '@/components/LineIcon';
import { FaqItem } from '@/components/FaqItem';
import { faqItems } from '@/lib/faq-content';

// よくある質問（2026-09-25 段階5）：カテゴリごとの白い紙面に、Qの印と開閉できる回答。
// 見本どおり、開いておくのは一番上の1問だけ（閉じた回答も HTML と FAQSchema に残る）。広告は8問目を含むカテゴリの後（従来と同じ1枠）。
// 2026-09-25 スマホの見直し：左右は外枠の16pxだけ、まとまりの間は12px、絞り込みの丸は44px。
export const FAQClient = () => {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const categories = [...new Set(faqItems.map(item => item.category))];
    const groups = categories
        .filter((category) => selectedCategory === null || category === selectedCategory)
        .map((category) => ({ category, items: faqItems.filter((item) => item.category === category) }));

    // 8問目（全体の並びで）を含むカテゴリの後に広告を置く
    let cumulative = 0;
    let adAfterCategory: string | null = null;
    for (const category of categories) {
        cumulative += faqItems.filter((item) => item.category === category).length;
        if (cumulative >= 8) {
            adAfterCategory = category;
            break;
        }
    }

    const chipClass = (active: boolean) => `inline-flex h-8 items-center rounded-full px-4 text-[13.5px] font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 sm:text-[14px] ${active
        ? 'bg-navy text-white'
        : 'bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50'}`;

    return (
        <div className="mx-auto flex w-full max-w-[840px] flex-col gap-3 pb-4 pt-1 sm:gap-6 sm:px-4 sm:pb-16 sm:pt-4">
            <header className="flex flex-col gap-2">
                <h1 className="font-display text-[24px] font-bold leading-snug text-slate-900 sm:text-[34px]">
                    よくある質問
                </h1>
                <p className="text-[14px] leading-[1.75] text-slate-700 sm:text-[15px]">
                    UMA-FREEの使い方、データの更新、AI偏差値の見方をまとめています。
                </p>
            </header>

            <div className="flex flex-wrap gap-2" role="group" aria-label="質問のカテゴリ">
                <button type="button" aria-pressed={selectedCategory === null} onClick={() => setSelectedCategory(null)} className={chipClass(selectedCategory === null)}>
                    すべて
                </button>
                {categories.map(category => (
                    <button
                        key={category}
                        type="button"
                        aria-pressed={selectedCategory === category}
                        onClick={() => setSelectedCategory(category)}
                        className={chipClass(selectedCategory === category)}
                    >
                        {category}
                    </button>
                ))}
            </div>

            {groups.map((group, groupIndex) => (
                <div key={group.category} className="flex flex-col gap-3 sm:gap-6">
                    <section
                        aria-labelledby={`faq-group-${groupIndex}`}
                        className="rounded-[16px] bg-white px-4 pb-1 pt-3.5 ring-1 ring-inset ring-slate-200 sm:px-6 sm:pt-5"
                    >
                        <h2 id={`faq-group-${groupIndex}`} className="font-display text-[18px] font-bold text-navy sm:text-[20px]">
                            {group.category}
                        </h2>
                        <div className="mt-1">
                            {/* ホームと同じ行（FaqItem）。初めは全部閉じる（2026-09-26 利用者の指定「ホーム同様」） */}
                            {group.items.map((item) => (
                                <FaqItem key={item.id} question={item.question}>{item.answer}</FaqItem>
                            ))}
                        </div>
                    </section>
                    {selectedCategory === null && group.category === adAfterCategory && (
                        <AdUnit slot="8529703346" placement="inline" />
                    )}
                </div>
            ))}

            {/* 見本：左に馬、右に見出しとボタン。枠線は付けず淡い面だけ */}
            <section className="flex items-center gap-3.5 rounded-[16px] bg-brand-50/70 p-4 sm:gap-4 sm:p-5">
                <GuideHorse size={68} mood="look" className="block h-14 w-14 shrink-0 sm:h-[68px] sm:w-[68px]" />
                <div className="flex flex-1 flex-col gap-3">
                    <p className="text-[15.5px] font-bold text-slate-900">解決しないときは</p>
                    <div className="flex flex-wrap gap-2">
                        <Link prefetch={false} href="/contact" className="ui-btn ui-btn--secondary gap-1">
                            お問い合わせ
                            <LineIcon name="chevR" size={16} className="block" />
                        </Link>
                        <Link href="/races/today" prefetch={false} className="ui-btn ui-btn--primary">
                            今日の分析を確認する
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
};

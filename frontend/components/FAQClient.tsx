'use client';

import Link from 'next/link';
import { useState } from 'react';
import Script from 'next/script';

interface FAQItem {
    id: string;
    category: string;
    question: string;
    answer: string;
    importance: 'high' | 'medium' | 'low';
}

const faqItems: FAQItem[] = [
    // サービス全般（重要度：高）
    {
        id: 'general-1',
        category: 'サービス全般',
        question: '本当に完全無料ですか？',
        answer:
            'はい、UMA-FREEのすべての機能は完全無料です。登録も不要で、煩わしいメールマガジンもありません。中央競馬・地方競馬の全レースの分析データを、無制限にご利用いただけます。',
        importance: 'high',
    },
    {
        id: 'general-2',
        category: 'サービス全般',
        question: '会員登録は必要ですか？',
        answer: 'いいえ、会員登録は一切不要です。URLにアクセスするだけで、すぐに分析データをご利用いただけます。',
        importance: 'high',
    },
    {
        id: 'general-3',
        category: 'サービス全般',
        question: '個人情報は取得されますか？',
        answer:
            'いいえ、個人情報の入力を求めることはありません。完全に匿名でご利用いただけます。ただし、サイト改善のためにアクセス解析（Google Analytics）を実施しており、個人を特定しない形式でのデータ収集は行っています。',
        importance: 'medium',
    },
    {
        id: 'general-4',
        category: 'サービス全般',
        question: 'データはいつ更新されますか？',
        answer: '毎日午前7時頃に、前日の確定結果と翌日の分析データが自動更新されます。更新時間は日によって多少前後する場合があります。',
        importance: 'high',
    },
    {
        id: 'general-5',
        category: 'サービス全般',
        question: 'どのデバイスで利用できますか？',
        answer:
            'PC、スマートフォン、タブレットなど、すべてのデバイスに対応しています。ブラウザで閲覧可能な環境があれば、どのデバイスからでもご利用いただけます。',
        importance: 'high',
    },

    // データ分析について（重要度：高）
    {
        id: 'prediction-1',
        category: 'データ分析',
        question: 'AI偏差値とは何ですか？',
        answer:
            '機械学習により算出した馬の能力スコアを偏差値形式で表示したものです。50が平均値で、数値が高いほどその統計分析では能力が高いと評価されています。ただし、あくまで推定値です。実際の結果とは異なる場合があります。',
        importance: 'high',
    },
    {
        id: 'prediction-2',
        category: 'データ分析',
        question: '分析データの精度はどのくらいですか？',
        answer:
            '本サイトの分析データは参考情報としてご活用ください。過去のデータマッチ結果は「高配当的中ランキング」でご確認いただけます。ただし、競馬は様々な予測不可能な要因に左右されるため、結果を保証するものではありません。',
        importance: 'high',
    },
    {
        id: 'prediction-3',
        category: 'データ分析',
        question: '分析が外れることはありますか？',
        answer:
            'はい、実際の結果が分析と異なることはよくあります。競馬は複数の馬が走行する複雑なレースであり、馬の調子、騎手の判断、天候変化など、予測不可能な要因が多くあります。分析は過去データに基づいていますが、すべてのケースを予測することはできません。',
        importance: 'high',
    },
    {
        id: 'prediction-4',
        category: 'データ分析',
        question: 'なぜ無料でデータを提供しているのですか？',
        answer:
            'UMA-FREEは、機械学習やデータ分析技術を学習・研究する目的でサイトを運営しています。個人開発者が趣味の範囲でデータ分析情報を公開しており、サイト運営を学習の一環としているためです。',
        importance: 'medium',
    },
    {
        id: 'prediction-5',
        category: 'データ分析',
        question: '分析データはどの競馬場に対応していますか？',
        answer:
            '中央競馬10場（札幌、函館、福島、新潟、東京、中山、中京、京都、阪神、小倉）と、地方競馬14場（門別、盛岡、水沢、浦和、船橋、大井、川崎、金沢、笠松、名古屋、園田、姫路、高知、佐賀）に対応しています。',
        importance: 'high',
    },

    // 馬券購入について（重要度：中）
    {
        id: 'ticket-1',
        category: '馬券購入',
        question: 'UMA-FREEから直接馬券を購入できますか？',
        answer:
            'いいえ、UMA-FREEは分析データの提供のみを目的としており、直接の馬券販売は行っていません。本サイトの分析データを参考にしたうえで、各種オンライン馬券販売サービス（JRA-VAN、各地方競馬場など）から馬券をご購入ください。',
        importance: 'high',
    },
    {
        id: 'ticket-2',
        category: '馬券購入',
        question: '初心者はどんな馬券から始めたらいいですか？',
        answer:
            '初心者には「複勝」または「単勝」をお勧めします。ルールがシンプルで、分析データを理解しやすいためです。複勝は単勝より的中確率が高く、初心者向けです。詳しくは「馬券の買い方・種類徹底解説」の記事をご参照ください。',
        importance: 'medium',
    },
    {
        id: 'ticket-3',
        category: '馬券購入',
        question: '20歳未満ですが、利用できますか？',
        answer:
            'UMA-FREEの閲覧自体に年齢制限はありませんが、日本の法律では20歳未満の馬券購入は禁止されています。分析データは学習目的などでご活用いただけますが、馬券の購入はご遠慮ください。',
        importance: 'high',
    },
    {
        id: 'ticket-4',
        category: '馬券購入',
        question: 'いくらから馬券を購入できますか？',
        answer:
            '競馬の馬券は通常100円から購入可能です。ただし、余裕資金で適度にお楽しみいただくことをお勧めしています。無理のない範囲での馬券購入をお願いいたします。',
        importance: 'medium',
    },

    // トラブルシューティング
    {
        id: 'support-1',
        category: 'トラブルシューティング',
        question: 'データが表示されません',
        answer:
            'ブラウザのキャッシュをクリアしてからアクセスしてみてください。それでも表示されない場合は、別のブラウザやデバイスから試してみてください。問題が解決しない場合は、お問い合わせフォームからご連絡ください。',
        importance: 'medium',
    },
    {
        id: 'support-2',
        category: 'トラブルシューティング',
        question: 'ページが重い/読み込みが遅い',
        answer:
            'インターネット接続の速度を確認してください。また、ブラウザで複数のタブを開いている場合は、不要なタブを閉じてみてください。それでも遅い場合は、別のブラウザからアクセスしてみてください。',
        importance: 'low',
    },
    {
        id: 'support-3',
        category: 'トラブルシューティング',
        question: '特定の日付のレースデータが見つかりません',
        answer:
            '競馬が開催されない日付を指定している可能性があります。中央競馬は主に土日開催、地方競馬は各競馬場ごとに異なる開催スケジュールです。近い開催日を選択してみてください。',
        importance: 'medium',
    },
];

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

    // FAQ Schema for structured data
    const faqSchema = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        'mainEntity': faqItems.map(item => ({
            '@type': 'Question',
            'name': item.question,
            'acceptedAnswer': {
                '@type': 'Answer',
                'text': item.answer
            }
        }))
    };

    return (
        <>
            <Script
                id="faq-schema"
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(faqSchema)
                }}
                strategy="afterInteractive"
            />
            <div className="container py-8">
                <div className="max-w-3xl mx-auto">
                    {/* ヘッダー */}
                    <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-6 border-b border-border pb-4">
                        よくある質問
                    </h1>
                    <p className="text-base text-text-secondary mb-8 leading-8">
                        UMA-FREEに関するご質問にお答えします。見つからない場合は、
                        <Link href="/contact" className="text-primary hover:text-primary-light font-semibold underline decoration-2 decoration-primary/30 hover:decoration-primary/60 transition-all ml-1">
                            お問い合わせ
                        </Link>
                        ください。
                    </p>

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
                        {filteredItems.map(item => {
                            const colors = getCategoryColor(item.category);
                            return (
                                <div key={item.id} className="bg-white p-6 rounded-xl border border-border shadow-sm">
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
        </>
    );
};

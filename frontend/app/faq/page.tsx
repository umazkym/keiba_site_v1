import type { Metadata } from 'next';
import { FAQClient } from '@/components/FAQClient';
import { Breadcrumb } from '@/components/Breadcrumb';

export const metadata: Metadata = {
    title: 'よくある質問',
    description: 'UMA-FREEに関するよくある質問と回答。無料機能、AI予測、データ更新、馬券購入方法などについて詳しくご説明します。',
    robots: {
        index: true,
        follow: true,
    },
    openGraph: {
        title: 'よくある質問',
        description: 'UMA-FREEのAI競馬分析に関するよくある質問。料金、データ更新タイミング、分析精度、モバイル対応など17の質問に回答しています。',
    },
    alternates: {
        canonical: '/faq',
    },
};

export default function FAQPage() {
    return (
        <div className="flex flex-col min-h-screen">
            <Breadcrumb />
            <div className="w-full bg-surface">
                <FAQClient />
            </div>
        </div>
    );
}

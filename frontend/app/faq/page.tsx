import type { Metadata } from 'next';
import { FAQClient } from '@/components/FAQClient';
import { Breadcrumb } from '@/components/Breadcrumb';

export const metadata: Metadata = {
    title: 'よくある質問 | UMA-FREE',
    description: 'UMA-FREEに関するよくある質問と回答。無料機能、AI予測、データ更新、馬券購入方法などについて詳しくご説明します。',
    robots: {
        index: true,
        follow: true,
    },
    alternates: {
        canonical: '/faq',
    },
};

export default function FAQPage() {
    return (
        <>
            <Breadcrumb />
            <FAQClient />
        </>
    );
}

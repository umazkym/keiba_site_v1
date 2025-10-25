import type { Metadata } from 'next';
import { FAQClient } from '@/components/FAQClient';

export const metadata: Metadata = {
    title: 'よくある質問 | UMA-FREE',
    description: 'UMA-FREEに関するよくある質問と回答。無料機能、AI予測、馬券購入方法などについてご説明します。',
};

export default function FAQPage() {
    return <FAQClient />;
}

import { Metadata } from 'next';

export const metadata: Metadata = {
    title: '運営者情報・このサイトについて | UMA-FREE',
    description: 'UMA-FREEの運営者情報とサービス内容について詳しく説明しています。AI競馬予測の仕組みやサイトの目的、技術情報などを公開しています。',
    robots: {
        index: true,
        follow: true,
    },
    openGraph: {
        title: '運営者情報・このサイトについて | UMA-FREE',
        description: 'UMA-FREEの運営者情報とサービス内容について詳しく説明しています。',
        url: 'https://uma-free.com/about',
        siteName: 'UMA-FREE',
        locale: 'ja_JP',
        type: 'website',
    },
    alternates: {
        canonical: 'https://uma-free.com/about',
    },
};

// コンテンツをデータとして定義
const aboutContent = {
    main: {
        title: 'このサイトについて',
        paragraphs: [
            'UMA-FREEは、個人開発者が運営する、独自のAIアルゴリズムを用いた競馬予想サイトです。中央競馬（JRA）および地方競馬（NAR）の全レースを対象に、全てのAI予測データを完全無料で公開しています。会員登録やメールアドレスの登録は一切不要です。',
            '本サイトが、皆様の競馬予想に新しい視点やデータに基づいた楽しみ方をもたらすきっかけの一つになれば幸いです。'
        ]
    },
    operatorInfo: {
        title: '運営者情報',
        items: [
            { label: 'サイト名', value: 'UMA-FREE' },
            { label: '運営者', value: 'おとうふや' },
            { label: 'サービス開始日', value: '2025年9月11日' },
            { label: 'お問い合わせ', value: '<a href="/contact" class="text-blue-600 hover:underline">お問い合わせフォーム</a>をご利用ください。' }
        ]
    },
    dataInfo: {
        title: '公開データについて',
        items: [
            { label: '全出走馬のAI偏差値', value: 'AIによる能力評価を偏差値として数値化したものです。過去のレースタイムや着順、コース適性などを総合的に判断しています。' },
            { label: 'AIスタート位置取り予測', value: '各馬の脚質や過去のレース展開データから、スタート直後の位置取りを予測します。逃げ・先行馬を探す際に役立ちます。' },
            { label: '過去対決データ', value: '出走馬同士が過去に同じレースで直接対決した際の成績を一覧で確認できます。馬同士の力関係を比較するのに便利です。' },
            { label: '枠順傾向スコア', value: '過去の膨大なレース結果から、コースや距離に応じた枠順の有利・不利をスコア化した独自のデータです。' }
        ]
    },
    techInfo: {
        title: '技術情報',
        intro: '本サービスは、以下の技術を活用して構築・運営されています：',
        items: [
            '<strong>AI/機械学習：</strong>Python, scikit-learn, pandas',
            '<strong>フロントエンド：</strong>Next.js, React, TypeScript, Tailwind CSS',
            '<strong>バックエンド：</strong>FastAPI, PostgreSQL',
            '<strong>インフラ：</strong>Vercel, Render'
        ]
    }
};


export default function AboutPage() {
    return (
        <div className="flex flex-col gap-8 py-12 px-4">
            <div className="max-w-4xl mx-auto w-full bg-white p-8 rounded-lg shadow-md border border-gray-200">
                <div className="flex flex-col gap-10">
                    <div>
                        <h1 className="text-4xl font-bold text-gray-800 mb-6 border-b-2 border-gray-300 pb-4">{aboutContent.main.title}</h1>
                        {aboutContent.main.paragraphs.map((text, index) => (<p key={index} className={`text-gray-700 leading-8 text-base ${index > 0 ? 'mt-4' : ''}`}>{text}</p>))}
                    </div>
                    <section className="flex flex-col gap-4">
                        <h2 className="text-3xl font-bold text-gray-800 border-b-2 border-gray-300 pb-3">{aboutContent.operatorInfo.title}</h2>
                        <dl className="flex flex-col gap-6">
                            {aboutContent.operatorInfo.items.map(item => (<div key={item.label} className="grid grid-cols-1 sm:grid-cols-4 gap-4"><dt className="font-bold text-gray-700 text-base">{item.label}</dt><dd className="sm:col-span-3 text-gray-800 text-base" dangerouslySetInnerHTML={{ __html: item.value }} /></div>))}
                        </dl>
                    </section>
                    <section className="flex flex-col gap-4">
                        <h2 className="text-3xl font-bold text-gray-800 border-b-2 border-gray-300 pb-3">{aboutContent.dataInfo.title}</h2>
                        <div className="flex flex-col gap-8">
                            {aboutContent.dataInfo.items.map(item => (<div key={item.label} className="flex flex-col gap-2"><h3 className="font-bold text-gray-800 text-lg">{item.label}</h3><p className="text-gray-700 text-base">{item.value}</p></div>))}
                        </div>
                    </section>
                    <section className="flex flex-col gap-4">
                        <h2 className="text-3xl font-bold text-gray-800 border-b-2 border-gray-300 pb-3">{aboutContent.techInfo.title}</h2>
                        <p className="text-gray-700 text-base mb-4">{aboutContent.techInfo.intro}</p>
                        <ul className="list-disc list-inside flex flex-col gap-3 text-gray-700">
                            {aboutContent.techInfo.items.map(item => (<li key={item} className="text-base" dangerouslySetInnerHTML={{ __html: item }} />))}
                        </ul>
                    </section>
                </div>
            </div>
        </div>
    );
}

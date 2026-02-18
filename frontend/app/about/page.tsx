import { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumb } from '@/components/Breadcrumb';

export const metadata: Metadata = {
    title: '運営者情報・このサイトについて',
    description: 'UMA-FREEの運営情報とサイトの趣旨について。競馬レースのデータ分析情報を参考提供しています。',
    robots: {
        index: true,
        follow: true,
    },
    openGraph: {
        title: '運営者情報・このサイトについて',
        description: 'UMA-FREEの運営情報とサイトの趣旨について。競馬レースのデータ分析情報を参考提供しています。',
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
            'UMA-FREEは、個人開発者が運営する競馬データ分析サイトです。機械学習やデータ分析技術を用いてレース結果を統計分析し、過去のデータパターンに基づいた情報を無料で公開しています。会員登録やメールアドレスの登録は不要です。',
            '本サイトの情報は参考・学習目的の統計分析です。実際の投票判断はご自身の責任において行ってください。'
        ]
    },
    operatorBackground: {
        title: '運営者について',
        paragraphs: [
            'UMA-FREEは個人開発者「おとうふや」が趣味・学習の延長として作成・運営しているサイトです。機械学習やデータ分析の技術を独学で学び、試作と検証を重ねてきました。このサイトは学習目的でのデータ分析研究を目的としています。',
            '2025年9月のサイト開設以来、中央競馬（JRA）全10競馬場および地方競馬（NAR）主要14競馬場の全レースを対象に、毎日データ分析を実施しています。これまでに累計数万レース以上のデータを蓄積・分析しており、分析モデルは継続的に検証・改善を行っています。',
            '当サイトで提供している統計分析情報は、過去5年以上のレース結果を基に機械学習などを用いて作成された参考情報です。完全な的中や利益を保証するものではありません。すべて参考値・推定値としてご理解ください。',
            '運営は個人的な活動であり、システム開発を本業として行っているわけではありません。投票の助言や推奨は行っていません。'
        ]
    },
    operatorInfo: {
        title: '運営者情報',
        items: [
            { label: 'サイト名', value: 'UMA-FREE' },
            { label: '運営者', value: 'おとうふや' },
            { label: 'サービス開始日', value: '2025年9月11日' },
            { label: '対応対象', value: '中央競馬（JRA）および地方競馬（NAR）のレースを対象に、可能な範囲で分析データを公開しています。' },
            { label: 'お問い合わせ', value: '<a href="/contact" class="text-primary hover:underline">お問い合わせフォーム</a>をご利用ください。' }
        ]
    },
    statistics: {
        title: 'サイト統計',
        items: [
            { label: '更新頻度', value: '基本的に毎日更新を目安にしています（概ね午前7時前後に前日の確定結果と翌日の分析データを掲載することが多いです）。' },
            { label: '分析対象', value: '中央競馬・地方競馬のレースを対象（全レースの掲載が常に可能とは限りません）。' },
            { label: '公開データ種類', value: 'AI偏差値、複勝率、勝率、能力順位、脚質予測、過去対決成績、枠順傾向スコア など。' },
            { label: 'データの基礎', value: '公開している分析は過去5年以上のレース結果を基に作成し、定期的に改善・検証を行っています。' }
        ]
    },
    dataInfo: {
        title: '公開データについて',
        items: [
            { label: 'AI偏差値', value: '機械学習により算出した能力スコアを偏差値形式で表示しています。過去の着順やタイム、コース適性など複数の要素を統計分析していますが、あくまで推定値です。実際の結果とは異なる場合があります。' },
            { label: '脚質予測', value: '過去のレース展開データを分析し、各馬のおおよその走法パターンを分類しています。参考情報としてご活用ください。' },
            { label: '過去対決データ', value: '同一レースで直接対決した際の成績を統計的に一覧にしています。馬同士の相対比較の参考になりますが、状況によって結果は変わります。' },
            { label: '枠順傾向スコア', value: '過去の統計データに基づき、コースや距離ごとの枠順の傾向をスコア化したものです。参考情報としてご利用ください。' }
        ]
    },
    dataQuality: {
        title: 'データの信頼性と透明性',
        paragraphs: [
            'AI偏差値は、過去の着順・走破タイム・上がりタイム・コース適性・馬場状態への対応力・距離適性など、複数の要素を統計モデルで重み付けして算出しています。',
            '本サイトの分析モデルは継続的に検証を行っており、過去データに基づく検証（バックテスト）と実際のレース結果との照合を定期的に実施しています。',
            '完全な予測は原理的に不可能であり、AI偏差値はあくまで相対的な能力の目安です。馬のコンディション、騎手の判断、天候、馬場状態の急変など、データに反映しきれない要素も多いため、結果の保証はできません。'
        ]
    },
    techInfo: {
        title: '技術情報',
        intro: '本サイトは趣味・学習の範囲で以下の技術を使って構築しています（商用の大規模システムとは異なります）：',
        items: [
            '<strong>AI/機械学習：</strong>Python、scikit-learn、pandas（試作・検証で利用）',
            '<strong>フロントエンド：</strong>Next.js、React、TypeScript、Tailwind CSS',
            '<strong>バックエンド：</strong>FastAPI、PostgreSQL（データ保存・APIに利用）',
            '<strong>インフラ：</strong>Vercel、Render（デプロイやホスティングに利用）'
        ]
    },
    disclaimer: {
        title: '注意事項',
        paragraphs: [
            '当サイトの情報は投票や投資の助言を行うものではありません。提供する統計分析情報はあくまで参考値であり、実際の投票判断は完全にご自身の責任においてお願いします。',
            '予測が外れることはよくあります。本サイトの情報により損失が生じても、当サイト及び運営者は一切の責任を負いません。',
            '分析に使用しているデータやモデルは継続的に改善していますが、結果の保証はできません。',
            '20歳未満の馬券購入は競馬法（第28条）により禁止されています。本サイトは成人を対象としています。',
            'ギャンブル依存症に関するご心配がある場合は、以下の窓口にご相談ください。<br/>・リカバリーサポート・ネットワーク（RSN）: <a href="tel:0120297338" class="text-rose-700 underline">0120-29-7338</a>（24時間対応）<br/>・消費者ホットライン: <a href="tel:188" class="text-rose-700 underline">188</a><br/>・JRA「競馬についてのお悩みをお聞かせください」: <a href="https://www.jra.go.jp/" target="_blank" rel="noopener noreferrer" class="text-rose-700 underline">JRA公式サイト</a>'
        ]
    }
};


export default function AboutPage() {
    // セクション用の統一されたスタイルを定義
    const sectionClass = "flex flex-col gap-3 sm:gap-4";
    const sectionTitleClass = "text-lg sm:text-2xl font-bold text-gray-800 border-b-2 border-gray-300 pb-2 sm:pb-3";

    return (
        <>
            <Breadcrumb />
            <div className="py-4 sm:py-8">
                <div className="max-w-3xl mx-auto">
                    <div className="flex flex-col gap-10">
                        {/* メインセクション */}
                        <div>
                            <h1 className="text-2xl sm:text-4xl font-bold text-primary mb-4 sm:mb-6 border-b border-border pb-3 sm:pb-4">{aboutContent.main.title}</h1>
                            {aboutContent.main.paragraphs.map((text, index) => (<p key={index} className={`text-text-secondary leading-8 text-base ${index > 0 ? 'mt-4' : ''}`}>{text}</p>))}
                        </div>

                        {/* 運営者について */}
                        <section className={sectionClass}>
                            <h2 className={sectionTitleClass}>{aboutContent.operatorBackground.title}</h2>
                            <div className="flex flex-col gap-4">
                                {aboutContent.operatorBackground.paragraphs.map((text, index) => (<p key={index} className="text-text-secondary leading-8 text-base">{text}</p>))}
                            </div>
                        </section>

                        {/* 運営者情報 */}
                        <section className={sectionClass}>
                            <h2 className={sectionTitleClass}>{aboutContent.operatorInfo.title}</h2>
                            <dl className="flex flex-col gap-6">
                                {aboutContent.operatorInfo.items.map(item => (<div key={item.label} className="grid grid-cols-1 sm:grid-cols-4 gap-4"><dt className="font-bold text-text-primary text-base">{item.label}</dt><dd className="sm:col-span-3 text-text-secondary text-base" dangerouslySetInnerHTML={{ __html: item.value }} /></div>))}
                            </dl>
                        </section>

                        {/* サイト統計 */}
                        <section className={sectionClass}>
                            <h2 className={sectionTitleClass}>{aboutContent.statistics.title}</h2>
                            <dl className="flex flex-col gap-6">
                                {aboutContent.statistics.items.map(item => (<div key={item.label} className="grid grid-cols-1 sm:grid-cols-4 gap-4"><dt className="font-bold text-text-primary text-base">{item.label}</dt><dd className="sm:col-span-3 text-text-secondary text-base">{item.value}</dd></div>))}
                            </dl>
                        </section>

                        {/* 公開データについて */}
                        <section className={sectionClass}>
                            <h2 className={sectionTitleClass}>{aboutContent.dataInfo.title}</h2>
                            <div className="flex flex-col gap-6">
                                {aboutContent.dataInfo.items.map(item => (<div key={item.label} className="border-l-4 border-slate-300 pl-4"><h3 className="font-bold text-text-primary text-base mb-2">{item.label}</h3><p className="text-text-secondary text-base">{item.value}</p></div>))}
                            </div>
                        </section>

                        {/* データの信頼性と透明性 */}
                        <section className={sectionClass}>
                            <h2 className={sectionTitleClass}>{aboutContent.dataQuality.title}</h2>
                            <div className="flex flex-col gap-4">
                                {aboutContent.dataQuality.paragraphs.map((text, index) => (<p key={index} className="text-text-secondary leading-8 text-base">{text}</p>))}
                            </div>
                        </section>

                        {/* 技術情報 */}
                        <section className={sectionClass}>
                            <h2 className={sectionTitleClass}>{aboutContent.techInfo.title}</h2>
                            <p className="text-text-secondary text-base mb-4">{aboutContent.techInfo.intro}</p>
                            <ul className="flex flex-col gap-3 text-text-secondary">
                                {aboutContent.techInfo.items.map(item => (<li key={item} className="text-base flex items-start gap-2"><span className="text-slate-400 font-bold flex-shrink-0">•</span><span dangerouslySetInnerHTML={{ __html: item }} /></li>))}
                            </ul>
                        </section>

                        {/* 注意事項 */}
                        <section className={sectionClass}>
                            <h2 className={sectionTitleClass}>{aboutContent.disclaimer.title}</h2>
                            <div className="flex flex-col gap-4 p-6 bg-rose-50 border-l-4 border-rose-400 rounded-r-lg">
                                {aboutContent.disclaimer.paragraphs.map((text, index) => (<p key={index} className="text-rose-900 leading-8 text-base" dangerouslySetInnerHTML={{ __html: text }} />))}
                            </div>
                        </section>

                        {/* 関連ページへの導線 */}
                        <section className={sectionClass}>
                            <h2 className={sectionTitleClass}>関連ページ</h2>
                            <div className="grid md:grid-cols-3 gap-6">
                                <Link href="/faq" className="p-6 bg-white rounded-xl border border-border hover:border-slate-400 hover:shadow-md transition-all group">
                                    <h3 className="font-bold text-text-primary mb-2 group-hover:text-primary transition-colors">よくある質問</h3>
                                    <p className="text-sm text-text-muted">FAQページで詳しくご説明しています。</p>
                                </Link>
                                <Link href="/contact" className="p-6 bg-white rounded-xl border border-border hover:border-slate-400 hover:shadow-md transition-all group">
                                    <h3 className="font-bold text-text-primary mb-2 group-hover:text-primary transition-colors">お問い合わせ</h3>
                                    <p className="text-sm text-text-muted">ご質問やご意見をお聞かせください。</p>
                                </Link>
                                <Link href="/articles" className="p-6 bg-white rounded-xl border border-border hover:border-slate-400 hover:shadow-md transition-all group">
                                    <h3 className="font-bold text-text-primary mb-2 group-hover:text-primary transition-colors">分析記事</h3>
                                    <p className="text-sm text-text-muted">データ分析に関する記事を公開中。</p>
                                </Link>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </>
    );
}

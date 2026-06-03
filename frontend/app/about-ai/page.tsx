import { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumb } from '@/components/Breadcrumb';
import { AdUnit } from '@/components/AdUnit';

export const metadata: Metadata = {
    title: '競馬データ分析の仕組み｜AI予想の根拠と使い方',
    description: 'UMA-FREEの競馬データ分析の仕組みを解説。AI偏差値、評価特徴量、バックテスト、得意条件と苦手条件をレース前にどう使うか整理します。',
    robots: {
        index: true,
        follow: true,
    },
    openGraph: {
        title: '競馬データ分析の仕組み｜AI予想の根拠と使い方',
        description: 'UMA-FREEの競馬データ分析の仕組みを解説。AI偏差値、評価特徴量、バックテスト、得意条件と苦手条件をレース前にどう使うか整理します。',
        url: 'https://uma-free.com/about-ai',
        siteName: 'UMA-FREE',
        locale: 'ja_JP',
        type: 'article',
    },
    alternates: {
        canonical: 'https://uma-free.com/about-ai',
    },
};

const aiContent = {
    main: {
        title: 'AI競馬予測モデルとデータサイエンス',
        paragraphs: [
            'UMA-FREE（ウマフリー）は、単なる直感や経験則ではなく、統計学と機械学習（Machine Learning）に基づいた客観的なデータサイエンスのアプローチで競馬を分析しています。',
            '当ページでは、本サイトがどのようなアルゴリズムを用い、どのようなデータを根拠にして「AI偏差値」等を算出しているのか、その技術的な裏側をホワイトペーパーとして公開します。透明性の高い情報提供を行うことで、ユーザーの皆様により深くデータ競馬の面白さを知っていただくことを目的としています。'
        ]
    },
    algorithm: {
        title: '採用しているアルゴリズム',
        paragraphs: [
            '当サイトの基盤となる予測モデルには、主にアンサンブル学習（Ensemble Learning）の一種である勾配ブースティング決定木（Gradient Boosting Decision Tree）を採用しています。具体的には、LightGBMやXGBoostといった高速かつ高性能なアルゴリズムをチューニングして利用しています。',
            '競馬のレースデータは「天候」「馬場状態」「血統」「騎手」「過去のタイム」など、連続値とカテゴリ値が複雑に絡み合う非線形な関係性を持っています。勾配ブースティングは、これらの複雑な特徴量の相互作用を捉え、スパーシティの高い（欠損値が多い）データに対してもロバストに予測できるため、競馬予測に非常に適しています。'
        ]
    },
    features: {
        title: '主要な評価特徴量（Features）',
        items: [
            { label: 'スピード指数・タイム', value: '過去数戦の走破タイムはもちろん、上がり3ハロン（終盤の瞬発力）や、レースのペース（前半と後半のタイム差）などを標準化して学習させています。' },
            { label: '適性データ', value: 'コース（芝/ダート）、距離、馬場状態（良・稍重・重・不良）、競馬場ごとの右回り/左回りや坂の有無など、対象馬の過去のパフォーマンスから固有の「適性スコア」を抽出しています。' },
            { label: '血統（Pedigree）', value: '種牡馬（父馬）やBMS（母の父）の産駒データを集計し、「特定の距離や馬場における血統的な期待値」を特徴量として組み込んでいます。' },
            { label: '騎手・調教師データ', value: '騎手とコースの相性、調教師（厩舎）の勝率や連対率など、人馬一体の指標も重要なベクトルとして扱っています。' },
            { label: '前走からの変化', value: '前走からの出走間隔（ローテーション）、斤量の増減、馬体重の変化など、当日の状態変化を推測するための時系列デリバティブを導入しています。' }
        ]
    },
    backtest: {
        title: 'バックテストとモデルの評価',
        paragraphs: [
            '開発にあたっては、過去数万レース分（数年分）のヒストリカルデータを使用し、厳密なクロスバリデーション（交差検証）を行っています。学習用（Train）、検証用（Validation）、テスト用（Test）にデータを期間で厳密に分割することで、未来のレースに対するオーバーフィッティング（過学習）を防いでいます。',
            'モデルの評価指標としては、単なる的中率だけでなく、ロジスティック損失（Logloss）やAUC-ROC（受信者動作特性曲線の下面積）といった統計的指標を最適化対象とし、確率予測の精度向上を目指しています。'
        ]
    },
    deviationScore: {
        title: 'AI偏差値とは何か？',
        paragraphs: [
            'AIが算出した「各馬の3着以内に入る推定確率」を、同じレースに出走する馬同士で比較しやすいように「偏差値（Mean=50, Std=10）」のスケールに変換したものが、当サイトで公開している【AI偏差値】です。',
            '偏差値50がそのレースにおける平均的な能力期待値を示し、60を超えれば上位クラス、70に近ければ圧倒的な能力を持つとAIが評価していることを意味します。'
        ]
    },
    disclaimer: {
        title: '限界と今後の課題',
        paragraphs: [
            'データサイエンスの力で長期的な傾向を導き出すことは可能ですが、競馬は「生き物」が走る競技であり、レース中の不利（落馬、進路妨害）、スタートの出遅れ、当日の極端なテンション変化など、データ化できないノイズ要素が非常に多く存在します。',
            'そのため、AI偏差値はあくまで「事前データから導き出される能力の期待値」であり、確実な結果を保証するものではありません。当サイトは今後も、展開予測モデルの追加や深層学習（ディープラーニング）の応用など、更なる精度の向上に向けた研究開発を継続していきます。'
        ]
    }
};

export default function AboutAiPage() {
    const sectionClass = "flex flex-col gap-3 sm:gap-4";
    const sectionTitleClass = "text-lg sm:text-2xl font-bold text-gray-800 border-b-2 border-gray-300 pb-2 sm:pb-3";

    return (
        <>
            <Breadcrumb />
            <div className="py-10 sm:py-16 px-4 w-full bg-surface">
                <div className="mx-auto w-full">
                    <div className="flex flex-col gap-12 sm:gap-16">

                        {/* メインセクション */}
                        <div className="text-center sm:text-left">
                            <h1 className="text-3xl sm:text-4xl font-bold text-text-primary mb-6 sm:mb-8 tracking-tight">{aiContent.main.title}</h1>
                            {aiContent.main.paragraphs.map((text, index) => (
                                <p key={index} className={`text-text-secondary leading-relaxed text-base sm:text-lg ${index > 0 ? 'mt-4' : ''}`}>
                                    {text}
                                </p>
                            ))}
                        </div>

                        {/* アルゴリズム */}
                        <section className={sectionClass}>
                            <h2 className={sectionTitleClass}>{aiContent.algorithm.title}</h2>
                            <div className="flex flex-col gap-4">
                                {aiContent.algorithm.paragraphs.map((text, index) => (
                                    <p key={index} className="text-text-secondary leading-8 text-base">{text}</p>
                                ))}
                            </div>
                        </section>

                        {/* 特徴量 */}
                        <section className={sectionClass}>
                            <h2 className={sectionTitleClass}>{aiContent.features.title}</h2>
                            <div className="flex flex-col gap-6 mt-2">
                                {aiContent.features.items.map(item => (
                                    <div key={item.label} className="border-l-4 border-primary pl-4 bg-white p-4 rounded-r-lg shadow-sm">
                                        <h3 className="font-bold text-text-primary text-lg mb-2">{item.label}</h3>
                                        <p className="text-text-secondary text-base leading-relaxed">{item.value}</p>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* 広告: 特徴量セクション後（コンテンツ中間のインプレッション） */}
                        <AdUnit slot="8529703346" placement="inline" />

                        {/* バックテスト */}
                        <section className={sectionClass}>
                            <h2 className={sectionTitleClass}>{aiContent.backtest.title}</h2>
                            <div className="flex flex-col gap-4">
                                {aiContent.backtest.paragraphs.map((text, index) => (
                                    <p key={index} className="text-text-secondary leading-8 text-base">{text}</p>
                                ))}
                            </div>
                        </section>

                        {/* AI偏差値 */}
                        <section className={sectionClass}>
                            <h2 className={sectionTitleClass}>{aiContent.deviationScore.title}</h2>
                            <div className="flex flex-col gap-4">
                                {aiContent.deviationScore.paragraphs.map((text, index) => (
                                    <p key={index} className="text-text-secondary leading-8 text-base">{text}</p>
                                ))}
                            </div>
                        </section>

                        {/* 限界と課題 */}
                        <section className={sectionClass}>
                            <h2 className={sectionTitleClass}>{aiContent.disclaimer.title}</h2>
                            <div className="flex flex-col gap-4 p-6 bg-slate-50 border-l-4 border-slate-400 rounded-r-lg">
                                {aiContent.disclaimer.paragraphs.map((text, index) => (
                                    <p key={index} className="text-slate-700 leading-8 text-base">{text}</p>
                                ))}
                            </div>
                        </section>


                        {/* 広告: 限界と課題セクション後（読了直後のインプレッション） */}
                        <AdUnit slot="1489598374" placement="inline" />

                        {/* 関連リンク */}
                        <section className={sectionClass}>
                            <h2 className={sectionTitleClass}>関連ページ</h2>
                            <div className="grid md:grid-cols-2 gap-6">
                                <Link href="/about" className="p-6 bg-white rounded-xl border border-border hover:border-primary hover:shadow-md transition-all group">
                                    <h3 className="font-bold text-text-primary mb-2 group-hover:text-primary transition-colors">運営者情報</h3>
                                    <p className="text-sm text-text-muted">当サイトの運営ポリシーや全体的な方針について。</p>
                                </Link>
                                <Link href="/articles" className="p-6 bg-white rounded-xl border border-border hover:border-primary hover:shadow-md transition-all group">
                                    <h3 className="font-bold text-text-primary mb-2 group-hover:text-primary transition-colors">データ分析記事一覧</h3>
                                    <p className="text-sm text-text-muted">AIやデータサイエンスを用いた競馬分析記事をご覧いただけます。</p>
                                </Link>
                            </div>
                        </section>

                    </div>
                </div>
            </div>
        </>
    );
}

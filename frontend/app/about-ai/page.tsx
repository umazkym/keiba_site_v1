import { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { AdUnit } from "@/components/AdUnit";
import { BreadcrumbSchema } from "@/components/StructuredData";
import {
  InfoCallout,
  InfoCardLink,
  InfoPageShell,
  InfoSection,
} from "@/components/InfoPageLayout";
import { shouldSuppressAdsInDevelopment } from "@/lib/ad-config";

export const metadata: Metadata = {
  title: "競馬データ分析の仕組み｜AI予想の根拠と使い方",
  description:
    "UMA-FREEの競馬データ分析の仕組みを解説。AI偏差値、評価特徴量、バックテスト、得意条件と苦手条件をレース前にどう使うか整理します。",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "競馬データ分析の仕組み｜AI予想の根拠と使い方",
    description:
      "UMA-FREEの競馬データ分析の仕組みを解説。AI偏差値、評価特徴量、バックテスト、得意条件と苦手条件をレース前にどう使うか整理します。",
    url: "https://uma-free.com/about-ai",
    siteName: "UMA-FREE",
    locale: "ja_JP",
    type: "article",
  },
  alternates: {
    canonical: "https://uma-free.com/about-ai",
  },
};

const featureItems = [
  {
    label: "スピード指数・タイム",
    body: "過去数戦の走破タイム、上がり3ハロン、前半と後半のラップ差などを標準化して扱います。",
  },
  {
    label: "適性データ",
    body: "芝・ダート、距離、馬場状態、右回り・左回り、坂の有無など、条件ごとの走りを整理します。",
  },
  {
    label: "血統",
    body: "種牡馬や母の父の傾向を集計し、特定の距離や馬場で見られる傾向を特徴量として組み込みます。",
  },
  {
    label: "騎手・調教師データ",
    body: "騎手とコースの相性、厩舎の傾向など、人馬の組み合わせに関するデータも確認します。",
  },
  {
    label: "前走からの変化",
    body: "出走間隔、斤量の増減、馬体重の変化など、当日の状態変化に関わる情報を加味します。",
  },
];

export default function AboutAiPage() {
  const shouldRenderAds = !shouldSuppressAdsInDevelopment;

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "ホーム", url: "https://uma-free.com" },
          { name: "AI予想の仕組み", url: "https://uma-free.com/about-ai" },
        ]}
      />
      <Breadcrumb />
      <InfoPageShell
        eyebrow="MODEL NOTE"
        title="AI競馬データ分析の仕組み"
        description={
          <>
            UMA-FREEは、直感や経験則だけではなく、統計学と機械学習に基づくデータ分析でレースを整理しています。
            このページでは、AI偏差値がどのような考え方で作られているか、透明性を重視して説明します。
          </>
        }
      >
        <InfoSection title="採用している分析モデル">
          <p>
            基盤となるモデルには、勾配ブースティング決定木など、表形式データと相性のよい機械学習手法を利用しています。
            競馬データは天候、馬場状態、血統、騎手、過去のタイムなど多くの要素が絡むため、複数の特徴量を組み合わせて評価します。
          </p>
          <p>
            ただし、どのモデルも万能ではありません。データに現れにくい当日の気配や不利、隊列のズレなどは、別の判断材料と合わせて確認する必要があります。
          </p>
        </InfoSection>

        <InfoSection title="主要な評価特徴量" tone="soft">
          <div className="grid gap-3 md:grid-cols-2">
            {featureItems.map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-base font-black text-slate-950">{item.label}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.body}</p>
              </div>
            ))}
          </div>
        </InfoSection>

        {shouldRenderAds && <AdUnit slot="8529703346" placement="inline" />}

        <InfoSection title="バックテストと評価">
          <p>
            開発時には過去数万レース分のデータを学習用、検証用、テスト用に分け、未来のレースを過去データで過度に説明しすぎないよう検証しています。
          </p>
          <p>
            評価では、単なる的中率だけでなく、確率予測のズレや条件別の得意・不得意も確認します。
            どの条件で参考にしやすく、どの条件で慎重に扱うべきかを把握することを重視しています。
          </p>
          <Link href="/results/accuracy" className="inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary">
            AI予想成績を確認する
          </Link>
        </InfoSection>

        <InfoSection title="AI偏差値とは何か">
          <p>
            AIが算出した各馬の評価を、同じレースに出走する馬同士で比較しやすいよう、偏差値形式に変換したものです。
            数字が高いほど、そのレース内で相対的に評価が高いことを示します。
          </p>
          <InfoCallout tone="notice">
            AI偏差値は「その馬が必ず走る」という意味ではありません。コース傾向、馬場、馬体重、枠順、騎手の条件適性と合わせて見るための参考指標です。
          </InfoCallout>
        </InfoSection>

        <InfoSection title="限界と今後の課題">
          <p>
            競馬は生き物が走る競技であり、レース中の不利、スタートの出遅れ、当日のテンション変化など、データ化しにくい要素が多くあります。
          </p>
          <p>
            そのため、AI偏差値は事前データから導き出される能力の期待値であり、結果を保証するものではありません。
            今後も展開予測や条件別の検証を継続し、公開データの改善を進めていきます。
          </p>
        </InfoSection>

        {shouldRenderAds && <AdUnit slot="1489598374" placement="inline" />}

        <InfoSection title="関連ページ" tone="soft">
          <div className="grid gap-3 md:grid-cols-3">
            <InfoCardLink href="/about" title="運営者情報" description="UMA-FREEの運営方針や公開データの扱いを確認できます。" />
            <InfoCardLink href="/keiba-data" title="データの見方" description="レース前にどの順番でデータを見るかを整理しています。" />
            <InfoCardLink href="/articles" title="分析記事一覧" description="重賞、騎手、コースなどのデータ分析記事をご覧いただけます。" />
          </div>
        </InfoSection>
      </InfoPageShell>
    </>
  );
}

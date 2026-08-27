import { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BreadcrumbSchema } from "@/components/StructuredData";
import {
  InfoCallout,
  InfoCardLink,
  InfoDefinitionList,
  InfoPageShell,
  InfoSection,
} from "@/components/InfoPageLayout";

export const metadata: Metadata = {
  title: "運営者情報・このサイトについて",
  description: "UMA-FREEの運営情報とサイトの趣旨について。競馬レースのデータ分析情報を参考提供しています。",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "運営者情報・このサイトについて",
    description: "UMA-FREEの運営情報とサイトの趣旨について。競馬レースのデータ分析情報を参考提供しています。",
    url: "https://uma-free.com/about",
    siteName: "UMA-FREE",
    locale: "ja_JP",
    type: "website",
  },
  alternates: {
    canonical: "https://uma-free.com/about",
  },
};

const operatorItems = [
  { label: "サイト名", value: "UMA-FREE" },
  { label: "運営者", value: "おとうふや" },
  { label: "サービス開始日", value: "2025年9月11日" },
  {
    label: "対応対象",
    value: "中央競馬（JRA）および地方競馬（NAR）のレースを対象に、可能な範囲で分析データを公開しています。",
  },
  {
    label: "お問い合わせ",
    value: (
      <>
        <Link href="/contact" className="font-bold text-primary hover:underline">
          お問い合わせフォーム
        </Link>
        をご利用ください。
      </>
    ),
  },
];

const statisticItems = [
  {
    label: "更新頻度",
    value: "基本的に毎日更新を目安にしています。開催状況に応じて前日の確定結果と翌日の分析データを掲載します。",
  },
  {
    label: "分析対象",
    value: "中央競馬・地方競馬のレースを対象にしています。全レースの掲載が常に可能とは限りません。",
  },
  {
    label: "公開データ種類",
    value: "AI偏差値、複勝率、勝率、能力順位、脚質予測、過去対決成績、このコースの枠順傾向など。",
  },
  {
    label: "データの基礎",
    value: "公開している分析は過去5年以上のレース結果を基に作成し、定期的に改善・検証を行っています。",
  },
];

const dataItems = [
  {
    label: "AI偏差値",
    value:
      "機械学習により算出した能力スコアを偏差値形式で表示しています。過去の着順やタイム、コース適性など複数の要素を統計分析していますが、あくまで推定値です。",
  },
  {
    label: "脚質予測",
    value: "過去のレース展開データを分析し、各馬のおおよその走法パターンを分類しています。",
  },
  {
    label: "過去対決データ",
    value:
      "同一レースで直接対決した際の成績を統計的に一覧にしています。馬同士の相対比較の参考になりますが、状況によって結果は変わります。",
  },
  {
    label: "このコースの枠順傾向",
    value: "過去の統計データに基づき、コースや距離ごとの枠順の傾向をスコア化したものです。",
  },
];

export default function AboutPage() {
  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "ホーム", url: "https://uma-free.com" },
          { name: "運営者情報", url: "https://uma-free.com/about" },
        ]}
      />
      <Breadcrumb />
      <InfoPageShell
        eyebrow="ABOUT UMA-FREE"
        title="このサイトについて"
        description={
          <>
            UMA-FREEは、個人開発者が運営する競馬データ分析サイトです。機械学習やデータ分析技術を用いてレース結果を統計分析し、過去のデータパターンに基づいた情報を無料で公開しています。
            会員登録やメールアドレスの登録は不要です。
          </>
        }
      >
        <InfoSection title="運営者について">
          <p>
            UMA-FREEは個人開発者「おとうふや」が趣味・学習の延長として作成・運営しているサイトです。
            機械学習やデータ分析の技術を独学で学び、試作と検証を重ねてきました。
          </p>
          <p>
            2025年9月のサイト開設以来、中央競馬（JRA）全10競馬場および地方競馬（NAR）主要14競馬場の全レースを対象に、毎日データ分析を実施しています。
            分析モデルは継続的に検証・改善を行っています。
          </p>
          <p>
            当サイトで提供している統計分析情報は、過去5年以上のレース結果を基に作成された参考情報です。
            完全な的中や利益を保証するものではありません。すべて参考値・推定値としてご理解ください。
          </p>
        </InfoSection>

        <InfoSection title="運営者情報" tone="soft">
          <InfoDefinitionList items={operatorItems} />
        </InfoSection>

        <InfoSection title="サイト統計" tone="soft">
          <InfoDefinitionList items={statisticItems} />
        </InfoSection>

        <InfoSection title="公開データについて">
          <div className="grid gap-3 sm:grid-cols-2">
            {dataItems.map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-black text-slate-950">{item.label}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.value}</p>
              </div>
            ))}
          </div>
        </InfoSection>

        <InfoSection title="データの信頼性と透明性">
          <p>
            AI偏差値は、過去の着順・走破タイム・上がりタイム・コース適性・馬場状態への対応力・距離適性など、複数の要素を統計モデルで重み付けして算出しています。
          </p>
          <p>
            分析モデルは継続的に検証を行っており、過去データに基づく検証と実際のレース結果との照合を定期的に実施しています。
          </p>
          <p>
            ただし、馬のコンディション、騎手の判断、天候、馬場状態の急変など、データに反映しきれない要素も多いため、結果の保証はできません。
          </p>
        </InfoSection>

        <InfoSection title="技術情報">
          <p>本サイトは趣味・学習の範囲で以下の技術を使って構築しています。</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              "AI/機械学習: Python、scikit-learn、pandas",
              "フロントエンド: Next.js、React、TypeScript、Tailwind CSS",
              "バックエンド: FastAPI、PostgreSQL",
              "インフラ: Google Cloud、Cloudflare、GitHub Actions",
            ].map((item) => (
              <li key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                {item}
              </li>
            ))}
          </ul>
        </InfoSection>

        <InfoSection title="注意事項">
          <InfoCallout tone="danger">
            <p>
              当サイトの情報は投票判断の助言や推奨を行うものではありません。提供する統計分析情報はあくまで参考値であり、実際の投票判断はご自身の責任においてお願いします。
            </p>
            <p className="mt-3">
              分析に使用しているデータやモデルは継続的に改善していますが、結果の保証はできません。20歳未満の馬券購入は競馬法（第28条）により禁止されています。
            </p>
            <p className="mt-3">
              ギャンブル依存症に関するご心配がある場合は、リカバリーサポート・ネットワーク（RSN）
              <a href="tel:0120297338" className="mx-1 font-bold underline">
                0120-29-7338
              </a>
              などの相談窓口をご確認ください。
            </p>
          </InfoCallout>
        </InfoSection>

        <InfoSection title="関連ページ" tone="soft">
          <div className="grid gap-3 md:grid-cols-3">
            <InfoCardLink href="/faq" title="よくある質問" description="UMA-FREEの使い方やデータ更新について確認できます。" />
            <InfoCardLink href="/contact" title="お問い合わせ" description="ご質問や不具合のご報告はこちらからお送りください。" />
            <InfoCardLink href="/articles" title="分析記事" description="重賞、騎手、コースなどのデータ分析記事を確認できます。" />
          </div>
        </InfoSection>
      </InfoPageShell>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BreadcrumbSchema } from "@/components/StructuredData";
import { InfoPageShell } from "@/components/InfoPageLayout";

export const metadata: Metadata = {
  title: "サイトマップ",
  description: "UMA-FREEのサイトマップです。AI競馬データ分析、分析記事、初心者向けガイド、よくある質問など、サイト内の全コンテンツへアクセスできます。",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "UMA-FREE サイトマップ",
    description: "UMA-FREE内の全ページをご案内するサイトマップです。過去のデータ分析から運営者情報まで、すべてのコンテンツをご確認いただけます。",
  },
  alternates: {
    canonical: "/sitemap",
  },
};

type SitemapGroup = {
  title: string;
  links: Array<{
    label: string;
    href: string;
    description?: string;
  }>;
};

function getTodayString() {
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  return today.toISOString().split("T")[0];
}

function SitemapCard({ group }: { group: SitemapGroup }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-2 sm:p-5 shadow-xs">
      <h2 className="flex items-center gap-1.5 text-[14.5px] font-black text-slate-950 sm:text-xl">
        <span className="h-3.5 w-1 rounded-sm bg-accent" />
        {group.title}
      </h2>
      <div className="mt-1.5 space-y-1 sm:mt-4 sm:space-y-2">
        {group.links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group block rounded-lg border border-slate-100 bg-slate-50 p-2 transition-colors hover:border-slate-300 hover:bg-white sm:p-4"
          >
            <span className="text-xs font-black text-slate-800 group-hover:text-primary sm:text-base">{link.label}</span>
            {link.description && <span className="mt-0.5 block text-[10.5px] leading-tight text-slate-500 sm:text-sm sm:leading-6">{link.description}</span>}
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function SitemapPage() {
  const todayStr = getTodayString();
  const groups: SitemapGroup[] = [
    {
      title: "レース分析",
      links: [
        { label: "トップページ", href: "/", description: "本日の開催、重要レース、最新記事を確認できます。" },
        { label: "今日のレース分析", href: `/races/${todayStr}`, description: "当日の全レース分析へ移動します。" },
        { label: "本日の分析", href: "/races/today", description: "現在の開催日のレース一覧を確認できます。" },
      ],
    },
    {
      title: "データと記事",
      links: [
        { label: "データ分析記事", href: "/articles", description: "重賞、騎手、コース、馬場などの記事一覧です。" },
        { label: "馬場状態の見方", href: "/keiba-data/track-condition", description: "馬場状態ごとの違いと確認順を整理しています。" },
        { label: "AI予想成績", href: "/results/accuracy", description: "AI偏差値の成績を期間別・条件別に確認できます。" },
      ],
    },
    {
      title: "データハブ",
      links: [
        { label: "競馬データベース", href: "/keiba-data", description: "競走馬、騎手、調教師、コースを横断して調べられます。" },
        { label: "競走馬データ", href: "/horses", description: "近走と条件別成績、AI偏差値履歴を確認できます。" },
        { label: "コース別データ", href: "/courses", description: "競馬場・距離ごとの傾向を確認できます。" },
        { label: "騎手別データ", href: "/jockeys", description: "主要騎手の条件別傾向を整理しています。" },
        { label: "調教師別データ", href: "/trainers", description: "管理馬の条件別成績を確認できます。" },
        { label: "重賞データ", href: "/grade-races", description: "G1・G2・G3の個別ハブです。" },
      ],
    },
    {
      title: "サポート・運営情報",
      links: [
        { label: "よくある質問", href: "/faq", description: "料金、更新、使い方などをまとめています。" },
        { label: "お問い合わせ", href: "/contact", description: "ご質問や不具合報告はこちらからお願いします。" },
        { label: "このサイトについて", href: "/about", description: "運営者情報と公開データの扱いを確認できます。" },
        { label: "サイト内検索", href: "/search", description: "記事やページをキーワードで探せます。" },
      ],
    },
    {
      title: "サイトポリシー",
      links: [
        { label: "プライバシーポリシー", href: "/privacy" },
        { label: "利用規約", href: "/terms" },
        { label: "広告について", href: "/advertising" },
        { label: "XML Sitemap", href: "/sitemap.xml" },
        { label: "データページXML Sitemap", href: "/sitemap-data.xml" },
      ],
    },
  ];

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "ホーム", url: "https://uma-free.com" },
          { name: "サイトマップ", url: "https://uma-free.com/sitemap" },
        ]}
      />
      <Breadcrumb />
      <InfoPageShell
        eyebrow="SITE MAP"
        title="サイトマップ"
        description={
          <>
            UMA-FREE内の主要ページをまとめています。お探しのページが見つからない場合は、
            <Link href="/search" className="font-bold text-primary hover:underline">
              サイト内検索
            </Link>
            もご利用ください。
          </>
        }
        maxWidth="wide"
      >
        <div className="grid gap-1.5 md:grid-cols-2 sm:gap-4">
          {groups.map((group) => (
            <SitemapCard key={group.title} group={group} />
          ))}
        </div>
      </InfoPageShell>
    </>
  );
}

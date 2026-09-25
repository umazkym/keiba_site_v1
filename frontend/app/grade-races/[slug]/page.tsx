import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BreadcrumbSchema } from "@/components/StructuredData";
import { EntityArticleSection } from "@/components/EntityArticleSection";
import { RaceSeriesPanel } from "@/components/RaceSeriesPanel";
import { getRaceSeriesData } from "@/lib/api";
import { getGradeRaceProfile } from "@/lib/grade-race-content";
import { getArticlesByGradeRaceEntity } from "@/lib/articles";

type Props = {
  params: { slug: string };
};

export const revalidate = 21600;
export const dynamicParams = true;

export function generateStaticParams() {
  // 年度別DB集計は初回アクセス時に生成し、以後は6時間ISRキャッシュする。
  return [];
}

export function generateMetadata({ params }: Props): Metadata {
  const race = getGradeRaceProfile(params.slug);
  if (!race) {
    return {
      title: "重賞データ分析",
      robots: { index: false, follow: true },
    };
  }

  return {
    title: `${race.name} ${race.date}｜${race.venue}${race.course}データ分析`,
    description: `${race.name}のデータ分析ハブ。${race.venue}${race.course}の傾向、枠順確定後の見方、レース後回顧で残すポイントを整理します。`,
    alternates: {
      canonical: `/grade-races/${race.slug}`,
    },
  };
}

export default async function GradeRaceDetailPage({ params }: Props) {
  const race = getGradeRaceProfile(params.slug);
  if (!race) notFound();
  const seriesData = await getRaceSeriesData(race.name);
  const bracketAlias = race.name.match(/[（(]([^）)]+)[）)]/)?.[1] || "";
  const baseRaceName = race.name.replace(/[（(][^）)]+[）)]/g, "");
  const raceArticles = getArticlesByGradeRaceEntity(
    race.slug,
    [race.name, baseRaceName, bracketAlias].filter(Boolean),
    10,
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: race.name,
    startDate: `${race.date}T15:40:00+09:00`,
    location: {
      "@type": "Place",
      name: `${race.venue}競馬場`,
    },
    description: race.summary,
    eventStatus: "https://schema.org/EventScheduled",
    url: `https://uma-free.com/grade-races/${race.slug}`,
    organizer: {
      "@type": "Organization",
      name: "UMA-FREE",
      url: "https://uma-free.com",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <BreadcrumbSchema
        items={[
          { name: "ホーム", url: "https://uma-free.com" },
          { name: "重賞データ", url: "https://uma-free.com/grade-races" },
          { name: race.name, url: `https://uma-free.com/grade-races/${race.slug}` },
        ]}
      />
      <Breadcrumb />
      <article className="mx-auto max-w-5xl px-3 pb-12 pt-4 sm:px-4 sm:pb-16">
        <header className="rounded-[16px] bg-white p-4 ring-1 ring-inset ring-slate-200 sm:p-8">
          <p className="text-[13px] font-bold text-slate-500">{race.grade}の重賞</p>
          <h1 className="mt-1 font-display text-[24px] font-bold leading-snug text-slate-900 sm:text-[34px]">
            {race.name} {race.date}
          </h1>
          <p className="mt-1.5 text-[13.5px] font-bold text-slate-600">
            {race.venue}{race.course} / {race.qualification}
          </p>
          <p className="mt-2 max-w-3xl text-[14px] leading-[1.75] text-slate-700 sm:text-base">{race.summary}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Link prefetch={false} href="/races/today" className="ui-btn ui-btn--primary">
              当日のAI予想を見る
            </Link>
          </div>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-[14px] bg-white p-5 ring-1 ring-inset ring-slate-200">
            <h2 className="font-display text-[19px] font-bold text-slate-900 sm:text-[21px]">レース前に見るポイント</h2>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
              {race.focusPoints.map((point) => (
                <li key={point} className="border-b border-slate-100 pb-2 last:border-b-0">{point}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-soft">
            <h2 className="font-display text-[19px] font-bold text-slate-900 sm:text-[21px]">更新の流れ</h2>
            <div className="mt-4 space-y-3">
              {race.updateStages.map((stage) => (
                <div key={stage.label} className="rounded-xl bg-white p-4 shadow-soft">
                  <p className="text-xs font-bold text-primary">{stage.label} / {stage.timing}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{stage.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <EntityArticleSection
          title={`${race.name}の記事`}
          articles={raceArticles}
          archiveHref={`/articles/grade-races/${race.slug}`}
          archiveLabel="記事アーカイブ"
        />

        <RaceSeriesPanel data={seriesData} />

        <section className="mt-10">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-950">レース後回顧テンプレート</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              "前半の流れと隊列",
              "勝ち馬の進路と脚質",
              "AI偏差値上位馬の結果",
              "枠順・馬場読みの成否",
              "不利・出遅れ・進路ロス",
              "次走で評価を上げる馬",
            ].map((item) => (
              <div key={item} className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-700 shadow-soft">
                {item}
              </div>
            ))}
          </div>
        </section>

        {/* 「X投稿の導線」は運営の内部の言葉だったため外した。回顧テンプレートの下の説明文もやめた（2026-09-26） */}
        <section className="mt-10">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-950">関連データ</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
            {race.relatedLinks.map((link) => (
              <Link prefetch={false} key={link.href} href={link.href} className="block p-4 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-primary">
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      </article>
    </>
  );
}

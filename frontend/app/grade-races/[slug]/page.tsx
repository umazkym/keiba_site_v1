import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BreadcrumbSchema } from "@/components/StructuredData";
import { getGradeRaceProfile, gradeRaceProfiles } from "@/lib/grade-race-content";

type Props = {
  params: { slug: string };
};

export function generateStaticParams() {
  return gradeRaceProfiles.map((race) => ({ slug: race.slug }));
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

export default function GradeRaceDetailPage({ params }: Props) {
  const race = getGradeRaceProfile(params.slug);
  if (!race) notFound();

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
        <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-accent" />
          <p className="text-xs font-bold tracking-[0.18em] text-slate-400">{race.grade} RACE HUB</p>
          <h1 className="mt-2 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            {race.name} {race.date}
          </h1>
          <p className="mt-3 text-sm font-bold text-slate-500">
            {race.venue}{race.course} / {race.qualification}
          </p>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">{race.summary}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link prefetch={false} href="/races/today" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-primary">
              当日のAI予想を見る
            </Link>
          </div>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <h2 className="text-xl font-black text-slate-950">レース前に見るポイント</h2>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
              {race.focusPoints.map((point) => (
                <li key={point} className="border-l-4 border-slate-300 pl-3">{point}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-soft">
            <h2 className="text-xl font-black text-slate-950">更新の流れ</h2>
            <div className="mt-4 space-y-3">
              {race.updateStages.map((stage) => (
                <div key={stage.label} className="rounded-xl bg-white p-4 shadow-soft">
                  <p className="text-xs font-black text-primary">{stage.label} / {stage.timing}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{stage.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-black text-slate-950">レース後回顧テンプレート</h2>
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
          <p className="mt-4 text-sm leading-7 text-slate-600">
            回顧では着順だけを見ず、当日の馬場、通ったコース、直線の進路、人気とのズレを残します。
            次走で同じ条件に戻る馬と、条件が変わって評価を下げたい馬を分けるための記録です。
          </p>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-black text-slate-950">関連データ</h2>
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
              {race.relatedLinks.map((link) => (
                <Link key={link.href} href={link.href} className="block p-4 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-primary">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-soft">
            <h2 className="text-xl font-black text-slate-950">X投稿の導線</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              投稿先はトップページではなく、このレース、関連コース、関連騎手ページへ直接送る方針です。
            </p>
            <div className="mt-4 space-y-2">
              {race.xPostThemes.map((theme) => (
                <a
                  key={theme}
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${theme}\n${race.name}のデータ整理はこちら`) }&url=${encodeURIComponent(`https://uma-free.com/grade-races/${race.slug}`)}`}
                  className="block rounded-xl bg-white p-3 text-sm font-bold text-slate-700 shadow-soft hover:text-primary"
                >
                  {theme}
                </a>
              ))}
            </div>
          </div>
        </section>
      </article>
    </>
  );
}

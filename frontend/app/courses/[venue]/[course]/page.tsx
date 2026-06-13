import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BreadcrumbSchema } from "@/components/StructuredData";
import { courseProfiles, getCourseProfile } from "@/lib/growth-content";

type Props = {
  params: { venue: string; course: string };
};

export function generateStaticParams() {
  return courseProfiles.map((profile) => ({
    venue: profile.venue,
    course: profile.course,
  }));
}

export function generateMetadata({ params }: Props): Metadata {
  const profile = getCourseProfile(params.venue, params.course);
  if (!profile) {
    return { title: "コースデータが見つかりません" };
  }

  return {
    title: profile.title,
    description: profile.metaDescription,
    robots: { index: false, follow: true },
    alternates: {
      canonical: `/courses/${profile.venue}/${profile.course}`,
    },
  };
}

export default function CoursePage({ params }: Props) {
  const profile = getCourseProfile(params.venue, params.course);
  if (!profile) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: profile.title,
    description: profile.metaDescription,
    url: `https://uma-free.com/courses/${profile.venue}/${profile.course}`,
    author: {
      "@type": "Organization",
      name: "UMA-FREE",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <BreadcrumbSchema
        items={[
          { name: "ホーム", url: "https://uma-free.com" },
          { name: "コース別データ", url: "https://uma-free.com/courses" },
          { name: profile.courseName, url: `https://uma-free.com/courses/${profile.venue}/${profile.course}` },
        ]}
      />
      <Breadcrumb />
      <article className="mx-auto max-w-4xl px-3 pb-12 pt-4 sm:px-4 sm:pb-16">
        <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-accent" />
          <p className="text-xs font-bold tracking-[0.18em] text-slate-400">COURSE DATA</p>
          <h1 className="mt-2 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            {profile.title}
          </h1>
          <p className="mt-4 text-base leading-8 text-slate-600">{profile.lead}</p>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {profile.stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
              <p className="text-xs font-bold tracking-[0.14em] text-slate-400">{stat.label}</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">{stat.value}</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">{stat.note}</p>
            </div>
          ))}
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-black text-slate-950">コースの読みどころ</h2>
          <ol className="mt-4 space-y-3 text-sm leading-8 text-slate-600">
            {profile.checkpoints.map((checkpoint, index) => (
              <li key={checkpoint} className="rounded-xl border-l-4 border-slate-300 bg-white p-4 shadow-soft">
                <strong className="text-slate-950">{index + 1}. </strong>
                {checkpoint}
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-soft">
          <h2 className="text-xl font-black text-slate-950">注意したいポイント</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">{profile.caution}</p>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <h2 className="text-xl font-black text-slate-950">関連記事</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.relatedArticles.map((link) => (
                <Link key={link.href} href={link.href} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:text-primary">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <h2 className="text-xl font-black text-slate-950">当日のレースに活かす</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              ここで確認したコース傾向を踏まえて、当日の出走馬をチェックしてみてください。
            </p>
            <Link href="/races/today" className="mt-4 inline-flex rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-primary">
              今日の該当レースを確認する
            </Link>
          </div>
        </section>
      </article>
    </>
  );
}

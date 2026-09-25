import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BreadcrumbSchema } from "@/components/StructuredData";
import { EntityArticleSection } from "@/components/EntityArticleSection";
import { getArticlesByJockeyEntity } from "@/lib/articles";
import { getJockeyProfile, jockeyProfiles } from "@/lib/growth-content";

type Props = {
  params: { slug: string };
};

export function generateStaticParams() {
  return jockeyProfiles.map((profile) => ({ slug: profile.slug }));
}

export function generateMetadata({ params }: Props): Metadata {
  const profile = getJockeyProfile(params.slug);
  if (!profile) {
    return { title: "騎手データが見つかりません" };
  }

  return {
    title: profile.searchTitle,
    description: profile.metaDescription,
    alternates: {
      canonical: `/jockeys/${profile.slug}`,
    },
  };
}

export default function JockeyPage({ params }: Props) {
  const profile = getJockeyProfile(params.slug);
  if (!profile) notFound();
  const shortName = profile.searchTitle.split("の")[0];
  const jockeyArticles = getArticlesByJockeyEntity(
    profile.slug,
    [profile.name, shortName].filter(Boolean),
    10,
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: profile.searchTitle,
    description: profile.metaDescription,
    url: `https://uma-free.com/jockeys/${profile.slug}`,
    mainEntity: {
      "@type": "Person",
      name: profile.name,
      jobTitle: "Jockey",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <BreadcrumbSchema
        items={[
          { name: "ホーム", url: "https://uma-free.com" },
          { name: "騎手別データ", url: "https://uma-free.com/jockeys" },
          { name: profile.name, url: `https://uma-free.com/jockeys/${profile.slug}` },
        ]}
      />
      <Breadcrumb />
      <article className="mx-auto max-w-4xl px-0 pb-2 pt-1.5 sm:px-4 sm:pb-16 sm:pt-4">
        <header className="rounded-[16px] bg-white p-4 ring-1 ring-inset ring-slate-200 sm:p-8">
          <p className="text-[13px] font-bold text-slate-500">騎手のデータ</p>
          <h1 className="mt-2 font-display text-[24px] font-bold leading-snug text-slate-900 sm:text-[34px]">
            {profile.searchTitle}
          </h1>
          <p className="mt-4 text-[15px] leading-[1.8] text-slate-700 sm:text-base sm:leading-8">{profile.lead}</p>
        </header>

        <section className="mt-8 rounded-[14px] bg-white p-5 ring-1 ring-inset ring-slate-200">
          <h2 className="font-display text-[19px] font-bold text-slate-900 sm:text-[21px]">騎乗傾向</h2>
          <p className="mt-3 text-sm leading-[1.8] text-slate-700 sm:leading-8">{profile.summary}</p>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="rounded-[14px] bg-white p-5 ring-1 ring-inset ring-slate-200">
            <h2 className="font-display text-[19px] font-bold text-slate-900 sm:text-[21px]">評価を上げたい条件</h2>
            <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-600">
              {profile.strengths.map((strength) => (
                <li key={strength} className="border-l-4 border-slate-300 pl-3">{strength}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-[14px] bg-white p-5 ring-1 ring-inset ring-slate-200">
            <h2 className="font-display text-[19px] font-bold text-slate-900 sm:text-[21px]">評価を下げたい条件</h2>
            <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-600">
              {profile.checkpoints.map((checkpoint) => (
                <li key={checkpoint} className="border-l-4 border-slate-300 pl-3">{checkpoint}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-soft">
            <h2 className="font-display text-[19px] font-bold text-slate-900 sm:text-[21px]">関連コース</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.courseLinks.map((link) => (
                <Link prefetch={false} key={link.href} href={link.href} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:text-primary">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-soft">
            <h2 className="font-display text-[19px] font-bold text-slate-900 sm:text-[21px]">関連記事</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.relatedArticles.map((link) => (
                <Link prefetch={false} key={link.href} href={link.href} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:text-primary">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <EntityArticleSection
          title={`${profile.name}の記事`}
          description="騎手別データ、得意コース、条件替わりの見方など、この騎手名に紐づく記事を自動で集約しています。"
          articles={jockeyArticles}
          archiveHref={`/articles/jockeys/${profile.slug}`}
          archiveLabel="記事アーカイブ"
        />

        <section className="mt-8 rounded-[14px] bg-white p-5 ring-1 ring-inset ring-slate-200">
          <h2 className="font-display text-[19px] font-bold text-slate-900 sm:text-[21px]">当日のレースに活かす</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            ここで押さえた得意条件を、当日の枠順・馬場・出走馬と照合してみてください。
          </p>
          <Link prefetch={false} href="/races/today" className="mt-4 inline-flex rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-primary">
            今日の騎乗レースを確認する
          </Link>
        </section>
      </article>
    </>
  );
}

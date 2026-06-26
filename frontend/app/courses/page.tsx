import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BreadcrumbSchema } from "@/components/StructuredData";
import { courseProfiles } from "@/lib/growth-content";

export const metadata: Metadata = {
  title: "競馬場・コース別データ分析",
  description:
    "中山ダート1200m、東京芝2000m、東京芝2400m、新潟芝1000mなど、競馬場と距離ごとの枠順・脚質傾向を無料で確認できます。",
  alternates: {
    canonical: "/courses",
  },
};

export default function CoursesPage() {
  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "ホーム", url: "https://uma-free.com" },
          { name: "コース別データ", url: "https://uma-free.com/courses" },
        ]}
      />
      <Breadcrumb />
      <div className="mx-auto max-w-6xl px-3 pb-12 pt-4 sm:px-4 sm:pb-16">
        <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-accent" />
          <p className="text-xs font-bold tracking-[0.18em] text-slate-400">COURSE DATA</p>
          <h1 className="mt-2 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            競馬場・コース別データ分析
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
            競馬場・距離ごとの枠順傾向、脚質の有利不利、馬場変化の影響をまとめています。
            レース当日のAI偏差値を見る前に、コース固有の癖を押さえておくと判断の土台が安定します。
          </p>
          <Link
            href="/articles#courses"
            className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-primary"
          >
            コース記事
          </Link>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courseProfiles.map((course) => (
            <Link
              key={`${course.venue}-${course.course}`}
              href={`/courses/${course.venue}/${course.course}`}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-elevated"
            >
              <p className="text-xs font-bold text-slate-400">{course.venueName}</p>
              <h2 className="mt-1 text-xl font-black text-slate-950 group-hover:text-primary">
                {course.courseName}
              </h2>
              <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-600">{course.lead}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {course.stats.slice(0, 2).map((stat) => (
                  <span key={stat.label} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                    {stat.value}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </section>
      </div>
    </>
  );
}

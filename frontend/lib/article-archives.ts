import type { ArticleMeta } from "@/lib/articles";
import {
  getAllArticles,
  getArticlesByCourseEntity,
  getArticlesByEntity,
  getArticlesByGradeRaceEntity,
  getArticlesByJockeyEntity,
} from "@/lib/articles";
import type { CourseProfile, JockeyProfile } from "@/lib/growth-content";
import { courseProfiles, getCourseProfile, getJockeyProfile, jockeyProfiles } from "@/lib/growth-content";
import type { GradeRaceProfile } from "@/lib/grade-race-content";
import { getGradeRaceProfile, gradeRaceProfiles } from "@/lib/grade-race-content";

export type ArticleArchiveKind = "grade-races" | "races" | "jockeys" | "courses";
export type GradeRaceCircuit = "jra" | "nar" | "overseas";
export type GradeRaceClass = "g1" | "g2" | "g3" | "jpn1" | "jpn2" | "jpn3" | "local" | "overseas" | "other";

export type ArticleArchiveGroup = {
  key: string;
  title: string;
  subtitle: string;
  description: string;
  href: string;
  profileHref: string;
  profileLabel: string;
  badges: string[];
  articles: ArticleMeta[];
  articleCount: number;
  latestDate: string;
  scheduledDate?: string;
  gradeRaceCircuit?: GradeRaceCircuit;
  gradeRaceClass?: GradeRaceClass;
};

export const articleArchiveKinds: Array<{
  kind: ArticleArchiveKind | "all";
  label: string;
  href: string;
  description: string;
}> = [
  {
    kind: "all",
    label: "すべて",
    href: "/articles",
    description: "新着順で記事を確認する",
  },
  {
    kind: "grade-races",
    label: "重賞別",
    href: "/articles#grade-races",
    description: "G1・重賞名",
  },
  {
    kind: "races",
    label: "レース名別",
    href: "/articles#races",
    description: "レース名",
  },
  {
    kind: "jockeys",
    label: "騎手別",
    href: "/articles#jockeys",
    description: "騎手名",
  },
  {
    kind: "courses",
    label: "コース別",
    href: "/articles#courses",
    description: "競馬場と距離",
  },
];

function formatLatestDate(articles: ArticleMeta[]): string {
  return articles[0]?.date || "";
}

function formatScheduledDate(articles: ArticleMeta[], fallback = ""): string {
  const dates = articles
    .map((article) => article.scheduledRaceDate || "")
    .filter(Boolean)
    .sort();
  return dates[0] || fallback;
}

function sortArchiveGroups(groups: ArticleArchiveGroup[]): ArticleArchiveGroup[] {
  return [...groups].sort((a, b) => {
    if (a.articleCount !== b.articleCount) return b.articleCount - a.articleCount;
    if (a.latestDate !== b.latestDate) return a.latestDate < b.latestDate ? 1 : -1;
    return a.title.localeCompare(b.title, "ja");
  });
}

type AdditionalGradeRaceSeed = {
  slug: string;
  name: string;
  grade: string;
  aliases: string[];
  venue?: string;
  course?: string;
  date?: string;
  circuit?: GradeRaceCircuit;
  gradeClass?: GradeRaceClass;
};

const additionalGradeRaceSeeds: AdditionalGradeRaceSeed[] = [
  { slug: "oaks", name: "優駿牝馬（オークス）", grade: "G1", aliases: ["オークス", "優駿牝馬"], venue: "東京", course: "芝2400m" },
  { slug: "niigata-daishoten", name: "新潟大賞典", grade: "G3", aliases: ["新潟大賞典"], venue: "新潟", course: "芝2000m" },
  { slug: "heian-stakes", name: "平安S", grade: "G3", aliases: ["平安S", "平安ステークス"], venue: "京都", course: "ダート1900m" },
  { slug: "meguro-kinen", name: "目黒記念", grade: "G2", aliases: ["目黒記念"], venue: "東京", course: "芝2500m" },
  { slug: "aoi-stakes", name: "葵S", grade: "G3", aliases: ["葵S", "葵ステークス"], venue: "京都", course: "芝1200m" },
  { slug: "hakodate-sprint-stakes", name: "函館スプリントS", grade: "G3", aliases: ["函館SS", "函館スプリントS", "函館スプリントステークス"], venue: "函館", course: "芝1200m" },
  { slug: "fuchu-himba-stakes", name: "府中牝馬S", grade: "G3", aliases: ["府中牝馬S", "府中牝馬ステークス"], venue: "東京", course: "芝1800m" },
  { slug: "shirasagi-stakes", name: "しらさぎS", grade: "重賞", aliases: ["しらさぎS", "しらさぎステークス"], venue: "阪神", course: "芝1600m" },
  { slug: "ichijo-kinen-michinoku-daishoten", name: "一條記念みちのく大賞典", grade: "地方重賞", aliases: ["一條記念みちのく大賞典", "みちのく大賞典"], venue: "水沢", course: "ダート2000m" },
  { slug: "aka-renga-kinen", name: "赤レンガ記念", grade: "地方重賞", aliases: ["赤レンガ記念"], venue: "門別", course: "ダート2000m" },
  { slug: "sakitama-hai", name: "さきたま杯", grade: "Jpn1", aliases: ["さきたま杯"], venue: "浦和", course: "ダート1400m", date: "2026-06-24" },
  { slug: "teio-sho", name: "帝王賞", grade: "Jpn1", aliases: ["帝王賞"], venue: "大井", course: "ダート2000m", date: "2026-07-01" },
  { slug: "queen-sho", name: "クイーン賞", grade: "Jpn3", aliases: ["クイーン賞"], venue: "船橋", course: "ダート1800m", date: "2026-02-11" },
  { slug: "radio-nikkei-sho", name: "ラジオNIKKEI賞", grade: "G3", aliases: ["ラジオNIKKEI賞", "ラジオＮＩＫＫＥＩ賞"], venue: "福島", course: "芝1800m" },
  { slug: "hakodate-kinen", name: "函館記念", grade: "G3", aliases: ["函館記念"], venue: "函館", course: "芝2000m" },
  { slug: "kitakyushu-kinen", name: "北九州記念", grade: "G3", aliases: ["北九州記念"], venue: "小倉", course: "芝1200m", date: "2026-07-05" },
  { slug: "sparking-lady-cup", name: "スパーキングレディーカップ", grade: "Jpn3", aliases: ["スパーキングレディーカップ"], venue: "川崎", course: "ダート1600m", date: "2026-07-08" },
  { slug: "sekirei-sho", name: "せきれい賞", grade: "地方重賞", aliases: ["せきれい賞"], venue: "盛岡", course: "ダート2000m", date: "2026-07-05" },
  { slug: "seiun-sho", name: "星雲賞", grade: "地方重賞", aliases: ["星雲賞"], venue: "門別", course: "ダート1200m", date: "2026-07-09" },
  { slug: "yamabiko-sho", name: "やまびこ賞", grade: "地方重賞", aliases: ["やまびこ賞"], venue: "盛岡", course: "ダート1800m", date: "2026-07-12" },
  { slug: "mercury-cup", name: "マーキュリーカップ", grade: "Jpn3", aliases: ["マーキュリーカップ"], venue: "盛岡", course: "ダート2000m", date: "2026-07-20" },
  { slug: "froilein-cup", name: "フロイラインカップ", grade: "地方重賞", aliases: ["フロイラインカップ"], venue: "門別", course: "ダート1700m" },
  { slug: "kanazawa-summer-cup", name: "金沢サマーカップ", grade: "地方重賞", aliases: ["金沢サマーカップ"], venue: "金沢", course: "ダート1400m", date: "2026-06-28" },
  { slug: "sapphire-sho", name: "サファイア賞", grade: "地方重賞", aliases: ["サファイア賞"], venue: "盛岡", course: "芝2400m", date: "2026-06-28" },
  { slug: "unicorn-stakes", name: "ユニコーンS", grade: "G3", aliases: ["ユニコーンS", "ユニコーンステークス"], venue: "京都", course: "ダート1900m" },
  { slug: "artemis-stakes", name: "アルテミスS", grade: "G3", aliases: ["アルテミスS", "アルテミスステークス"], venue: "東京", course: "芝1600m" },
  { slug: "kikka-sho", name: "菊花賞", grade: "G1", aliases: ["菊花賞"], venue: "京都", course: "芝3000m" },
  { slug: "elizabeth-queen-cup", name: "エリザベス女王杯", grade: "G1", aliases: ["エリザベス女王杯"], venue: "京都", course: "芝2200m" },
  { slug: "dubai-world-cup", name: "ドバイWC", grade: "海外G1", aliases: ["ドバイWC", "ドバイワールドカップ"] },
];

function normalizeGradeLabel(grade: string): string {
  return grade.replace(/\s+/g, "").toUpperCase();
}

function inferGradeRaceMeta(
  grade: string,
  venue = "",
  explicitCircuit?: GradeRaceCircuit,
  explicitClass?: GradeRaceClass,
): { circuit: GradeRaceCircuit; gradeClass: GradeRaceClass } {
  const normalized = normalizeGradeLabel(grade);
  if (explicitCircuit && explicitClass) {
    return { circuit: explicitCircuit, gradeClass: explicitClass };
  }
  if (normalized.includes("海外")) {
    return { circuit: "overseas", gradeClass: "overseas" };
  }
  if (normalized === "JPN1" || normalized === "JPNI") {
    return { circuit: "nar", gradeClass: "jpn1" };
  }
  if (normalized === "JPN2" || normalized === "JPNII") {
    return { circuit: "nar", gradeClass: "jpn2" };
  }
  if (normalized === "JPN3" || normalized === "JPNIII") {
    return { circuit: "nar", gradeClass: "jpn3" };
  }
  if (normalized.includes("地方")) {
    return { circuit: "nar", gradeClass: "local" };
  }
  if (normalized === "G1" || normalized === "GI") {
    return { circuit: "jra", gradeClass: "g1" };
  }
  if (normalized === "G2" || normalized === "GII") {
    return { circuit: "jra", gradeClass: "g2" };
  }
  if (normalized === "G3" || normalized === "GIII") {
    return { circuit: "jra", gradeClass: "g3" };
  }

  const localVenues = ["門別", "盛岡", "水沢", "浦和", "船橋", "大井", "川崎", "金沢", "笠松", "名古屋", "園田", "姫路", "高知", "佐賀"];
  if (explicitCircuit === "nar" || localVenues.some((localVenue) => venue.includes(localVenue))) {
    return { circuit: "nar", gradeClass: "local" };
  }
  return { circuit: explicitCircuit || "jra", gradeClass: explicitClass || "other" };
}

export function getGradeRaceArticleAliases(race: GradeRaceProfile): string[] {
  const bracketAlias = race.name.match(/[（(]([^）)]+)[）)]/)?.[1] || "";
  const baseRaceName = race.name.replace(/[（(][^）)]+[）)]/g, "");
  return [race.name, baseRaceName, bracketAlias].filter(Boolean);
}

export function getJockeyArticleAliases(jockey: JockeyProfile): string[] {
  const shortName = jockey.searchTitle.split("の")[0];
  return [jockey.name, shortName].filter(Boolean);
}

function gradeRaceToArchiveGroup(race: GradeRaceProfile): ArticleArchiveGroup {
  const articles = getArticlesByGradeRaceEntity(race.slug, getGradeRaceArticleAliases(race), 100);
  const gradeMeta = inferGradeRaceMeta(race.grade, race.venue);
  return {
    key: race.slug,
    title: race.name,
    subtitle: `${race.grade} / ${race.venue}${race.course}`,
    description: race.summary,
    href: `/articles/grade-races/${race.slug}`,
    profileHref: `/grade-races/${race.slug}`,
    profileLabel: "重賞データ",
    badges: [race.grade, race.venue, race.course],
    articles,
    articleCount: articles.length,
    latestDate: formatLatestDate(articles),
    scheduledDate: formatScheduledDate(articles, race.date),
    gradeRaceCircuit: gradeMeta.circuit,
    gradeRaceClass: gradeMeta.gradeClass,
  };
}

function additionalGradeRaceToArchiveGroup(seed: AdditionalGradeRaceSeed): ArticleArchiveGroup {
  const articles = getArticlesByGradeRaceEntity(seed.slug, [seed.name, ...seed.aliases], 100);
  const courseLabel = [seed.venue, seed.course].filter(Boolean).join("");
  const gradeMeta = inferGradeRaceMeta(seed.grade, seed.venue, seed.circuit, seed.gradeClass);
  return {
    key: seed.slug,
    title: seed.name,
    subtitle: [seed.grade, courseLabel].filter(Boolean).join(" / "),
    description: `${seed.name}に関する出走構成、枠順、馬場、振り返りの記事をまとめます。`,
    href: `/articles/grade-races/${seed.slug}`,
    profileHref: "/articles#grade-races",
    profileLabel: "重賞",
    badges: [seed.grade, seed.venue || "", seed.course || ""].filter(Boolean),
    articles,
    articleCount: articles.length,
    latestDate: formatLatestDate(articles),
    scheduledDate: formatScheduledDate(articles, seed.date || ""),
    gradeRaceCircuit: gradeMeta.circuit,
    gradeRaceClass: gradeMeta.gradeClass,
  };
}

function jockeyToArchiveGroup(jockey: JockeyProfile): ArticleArchiveGroup {
  const articles = getArticlesByJockeyEntity(jockey.slug, getJockeyArticleAliases(jockey), 100);
  return {
    key: jockey.slug,
    title: jockey.name,
    subtitle: jockey.searchTitle,
    description: jockey.summary,
    href: `/articles/jockeys/${jockey.slug}`,
    profileHref: `/jockeys/${jockey.slug}`,
    profileLabel: "騎手データ",
    badges: jockey.strengths.slice(0, 3),
    articles,
    articleCount: articles.length,
    latestDate: formatLatestDate(articles),
  };
}

function courseToArchiveGroup(course: CourseProfile): ArticleArchiveGroup {
  const articles = getArticlesByCourseEntity(
    course.venue,
    course.course,
    course.venueName,
    course.courseName,
    100,
  );
  return {
    key: `${course.venue}-${course.course}`,
    title: `${course.venueName}${course.courseName}`,
    subtitle: course.title,
    description: course.lead,
    href: `/articles/courses/${course.venue}/${course.course}`,
    profileHref: `/courses/${course.venue}/${course.course}`,
    profileLabel: "コースデータ",
    badges: [course.venueName, course.courseName, ...course.stats.slice(0, 1).map((stat) => stat.value)],
    articles,
    articleCount: articles.length,
    latestDate: formatLatestDate(articles),
  };
}

function articleTitleForRaceGroup(article: ArticleMeta, entityKey: string): string {
  const keyword = article.targetKeyword || article.title || entityKey;
  return keyword
    .replace(/20\d{2}/g, "")
    .replace(/AI予想|ai予想|無料|攻略|展望|直前|最終|枠順確定後|枠順|前日更新|前日|当日朝更新|当日朝|データ|分析|予想|ポイント|確認/g, "")
    .replace(/[｜|:：].*$/g, "")
    .replace(/\s+/g, " ")
    .trim() || entityKey;
}

function getRaceEntityKeys(): string[] {
  return Array.from(
    new Set(
      getAllArticles()
        .filter((article) => article.entityType === "race" && article.entityKey)
        .map((article) => article.entityKey as string),
    ),
  ).sort();
}

export function getRaceArticleArchiveGroups(): ArticleArchiveGroup[] {
  const groups = getRaceEntityKeys().map((entityKey) => {
    const articles = getArticlesByEntity({
      entityType: "race",
      entityKey,
      entityPath: `/articles/races/${entityKey}`,
      count: 100,
    });
    const firstArticle = articles[0];
    const title = firstArticle ? articleTitleForRaceGroup(firstArticle, entityKey) : entityKey;
    return {
      key: entityKey,
      title,
      subtitle: "レース名別の記事",
      description: firstArticle?.description || `${title}に紐づく記事を1本のURLで更新していきます。`,
      href: `/articles/races/${entityKey}`,
      profileHref: "/races/today",
      profileLabel: "本日のレース",
      badges: ["レース名", firstArticle?.category || "記事"].filter(Boolean),
      articles,
      articleCount: articles.length,
      latestDate: formatLatestDate(articles),
    };
  });

  return sortArchiveGroups(groups);
}

export function getGradeRaceArticleArchiveGroups(): ArticleArchiveGroup[] {
  const profileGroups = gradeRaceProfiles.map(gradeRaceToArchiveGroup);
  const profileKeys = new Set(profileGroups.map((group) => group.key));
  const additionalGroups = additionalGradeRaceSeeds
    .filter((seed) => !profileKeys.has(seed.slug))
    .map(additionalGradeRaceToArchiveGroup);
  return sortArchiveGroups([...profileGroups, ...additionalGroups]);
}

export type GradeRaceArchiveSection = {
  id: string;
  title: string;
  groups: ArticleArchiveGroup[];
  groupCount: number;
  articleCount: number;
};

const gradeRaceArchiveSectionDefinitions: Array<{
  id: string;
  title: string;
  circuit: GradeRaceCircuit;
  classes: GradeRaceClass[];
}> = [
  { id: "jra-g1", title: "中央 G1", circuit: "jra", classes: ["g1"] },
  { id: "jra-g2", title: "中央 G2", circuit: "jra", classes: ["g2"] },
  { id: "jra-g3", title: "中央 G3", circuit: "jra", classes: ["g3"] },
  { id: "jra-other", title: "中央 その他", circuit: "jra", classes: ["other"] },
  { id: "nar-jpn1", title: "地方 Jpn1", circuit: "nar", classes: ["jpn1"] },
  { id: "nar-jpn2", title: "地方 Jpn2", circuit: "nar", classes: ["jpn2"] },
  { id: "nar-jpn3", title: "地方 Jpn3", circuit: "nar", classes: ["jpn3"] },
  { id: "nar-local", title: "地方 その他重賞", circuit: "nar", classes: ["local"] },
  { id: "overseas", title: "海外", circuit: "overseas", classes: ["overseas"] },
];

export function getGradeRaceArticleArchiveSections(
  groups = getGradeRaceArticleArchiveGroups(),
): GradeRaceArchiveSection[] {
  const visibleGroups = groups.filter((group) => group.articleCount > 0);
  return gradeRaceArchiveSectionDefinitions
    .map((section) => {
      const sectionGroups = visibleGroups.filter(
        (group) =>
          group.gradeRaceCircuit === section.circuit &&
          section.classes.includes(group.gradeRaceClass || "other"),
      );
      return {
        id: section.id,
        title: section.title,
        groups: sectionGroups,
        groupCount: sectionGroups.length,
        articleCount: sectionGroups.reduce((sum, group) => sum + group.articleCount, 0),
      };
    })
    .filter((section) => section.groupCount > 0);
}

export function getJockeyArticleArchiveGroups(): ArticleArchiveGroup[] {
  return sortArchiveGroups(jockeyProfiles.map(jockeyToArchiveGroup));
}

export function getCourseArticleArchiveGroups(): ArticleArchiveGroup[] {
  return sortArchiveGroups(courseProfiles.map(courseToArchiveGroup));
}

export function getRaceArticleArchiveGroup(slug: string): ArticleArchiveGroup | null {
  return getRaceArticleArchiveGroups().find((group) => group.key === slug) || null;
}

export function getGradeRaceArticleArchiveGroup(slug: string): ArticleArchiveGroup | null {
  const race = getGradeRaceProfile(slug);
  if (race) return gradeRaceToArchiveGroup(race);
  return getGradeRaceArticleArchiveGroups().find((group) => group.key === slug) || null;
}

export function getJockeyArticleArchiveGroup(slug: string): ArticleArchiveGroup | null {
  const jockey = getJockeyProfile(slug);
  return jockey ? jockeyToArchiveGroup(jockey) : null;
}

export function getCourseArticleArchiveGroup(venue: string, course: string): ArticleArchiveGroup | null {
  const profile = getCourseProfile(venue, course);
  return profile ? courseToArchiveGroup(profile) : null;
}

export function getArticleArchiveTotals() {
  const gradeRaceGroups = getGradeRaceArticleArchiveGroups();
  const raceGroups = getRaceArticleArchiveGroups();
  const jockeyGroups = getJockeyArticleArchiveGroups();
  const courseGroups = getCourseArticleArchiveGroups();
  return {
    gradeRaceCount: gradeRaceGroups.reduce((sum, group) => sum + group.articleCount, 0),
    raceCount: raceGroups.reduce((sum, group) => sum + group.articleCount, 0),
    jockeyCount: jockeyGroups.reduce((sum, group) => sum + group.articleCount, 0),
    courseCount: courseGroups.reduce((sum, group) => sum + group.articleCount, 0),
    gradeRaceGroups,
    raceGroups,
    jockeyGroups,
    courseGroups,
  };
}

function jstDateString(date = new Date()): string {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function dateDiffDays(date: string, baseDate: string): number {
  const dateMs = new Date(`${date}T00:00:00+09:00`).getTime();
  const baseMs = new Date(`${baseDate}T00:00:00+09:00`).getTime();
  return Math.round((dateMs - baseMs) / 86400000);
}

export function getUpcomingGradeRaceArticleGroups(count = 4): ArticleArchiveGroup[] {
  const today = jstDateString();
  return getGradeRaceArticleArchiveGroups()
    .filter((group) => group.articleCount > 0 && group.scheduledDate)
    .map((group) => ({ group, diff: dateDiffDays(group.scheduledDate as string, today) }))
    .filter(({ diff }) => diff >= -1 && diff <= 14)
    .sort((a, b) => {
      if (a.diff !== b.diff) return a.diff - b.diff;
      if (a.group.articleCount !== b.group.articleCount) return b.group.articleCount - a.group.articleCount;
      return a.group.title.localeCompare(b.group.title, "ja");
    })
    .slice(0, count)
    .map(({ group }) => group);
}

export function getArticleArchiveGroupForArticle(article: Pick<ArticleMeta, "slug" | "entityType" | "entityKey" | "entityPath" | "canonicalPath">): ArticleArchiveGroup | null {
  const groups = [
    ...getGradeRaceArticleArchiveGroups(),
    ...getRaceArticleArchiveGroups(),
    ...getJockeyArticleArchiveGroups(),
    ...getCourseArticleArchiveGroups(),
  ].filter((group) => group.articleCount > 0);

  return (
    groups.find((group) => {
      if (group.articles.some((item) => item.slug === article.slug)) return true;
      if (article.entityPath && article.entityPath === group.href) return true;
      if (article.canonicalPath && article.canonicalPath === group.href) return true;
      return Boolean(article.entityKey && article.entityKey === group.key);
    }) || null
  );
}

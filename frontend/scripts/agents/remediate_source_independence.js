const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

const ARTICLE_DIR = path.join(process.cwd(), "content", "articles");
const APPLY = process.argv.includes("--apply");
const UPDATED_AT = "2026-07-21T00:00:00.000Z";

const LEGACY_ARTICLE_UPDATES = {
  "2026-07-03-2026-bb47f61b.md": {
    title: "スパーキングレディーカップ2026｜川崎ダート1600mの適性確認順",
    description:
      "スパーキングレディーカップ2026の出走馬を、川崎ダート1600mのコース形状、近走の脚質、地方ダート実績、枠順から比較します。ナイターの小回りコースで確認したい優先順位を整理します。",
    target_keyword: "スパーキングレディーカップ2026 出走馬 コース適性",
    theme_cluster: "race_update",
    category: "重賞攻略",
    article_type: "race_update",
    content_target: "grade_race_article",
    search_intent: "race_profile",
    content_focus: "川崎ダート1600mの形状と出走馬の近走を比較する",
    entity_type: "grade_race",
    entity_key: "sparking-lady-cup",
    entity_path: "/articles/grade-races/sparking-lady-cup",
    canonical_path: "/articles/grade-races/sparking-lady-cup",
    pointHeading: "## 出走馬を確認する順序",
  },
  "2026-07-04-2000-fbeda3b1.md": {
    title: "せきれい賞2026｜ダート2000m変更後のAI偏差値と適性確認",
    description:
      "せきれい賞2026は芝2400mからダート2000mへ条件が変更されました。変更前の評価をそのまま使わず、ダート実績、距離適性、脚質、AI偏差値を読み直すための確認順を整理します。",
    target_keyword: "せきれい賞2026 ダート2000m AI偏差値",
    theme_cluster: "race_update",
    category: "重賞攻略",
    article_type: "race_update",
    content_target: "grade_race_article",
    search_intent: "race_profile",
    content_focus: "条件変更後のダート適性と掲載済み予測値を読み直す",
    entity_type: "grade_race",
    entity_key: "sekirei-sho",
    entity_path: "/articles/grade-races/sekirei-sho",
    canonical_path: "/articles/grade-races/sekirei-sho",
    pointHeading: "## 条件変更後に確認する項目",
  },
  "2026-07-07-2026-7d197ba2.md": {
    title: "星雲賞2026｜門別1200mの枠順・脚質を確認する順序",
    description:
      "星雲賞2026の出走構成を、門別1200mのコース形状、枠順、先行力、当日の馬場から確認します。短距離戦で持ち時計だけに偏らず、隊列と各馬の再現性を比較する順序を整理します。",
    target_keyword: "星雲賞2026 門別1200m 枠順 脚質",
    theme_cluster: "race_update",
    category: "重賞攻略",
    article_type: "race_update",
    content_target: "grade_race_article",
    search_intent: "race_profile",
    content_focus: "門別1200mの枠順と脚質構成を比較する",
    entity_type: "grade_race",
    entity_key: "seiun-sho",
    entity_path: "/articles/grade-races/seiun-sho",
    canonical_path: "/articles/grade-races/seiun-sho",
    pointHeading: "## 星雲賞で確認する項目",
  },
  "2026-07-10-2026-6fc388d7.md": {
    title: "やまびこ賞2026｜盛岡1800mの枠順・脚質を確認する順序",
    description:
      "やまびこ賞2026の出走馬を、盛岡ダート1800mのコース形状、枠順、馬番傾向、脚質から比較します。掲載データを当日の馬場と組み合わせ、確認する順序を整理します。",
    target_keyword: "やまびこ賞2026 盛岡1800m 枠順 脚質",
    theme_cluster: "race_update",
    category: "重賞攻略",
    article_type: "race_update",
    content_target: "grade_race_article",
    search_intent: "race_profile",
    content_focus: "盛岡ダート1800mの枠順と脚質構成を比較する",
    entity_type: "grade_race",
    entity_key: "yamabiko-sho",
    entity_path: "/articles/grade-races/yamabiko-sho",
    canonical_path: "/articles/grade-races/yamabiko-sho",
    pointHeading: "## やまびこ賞で確認する項目",
  },
  "2026-07-13-2026-503c1de6.md": {
    title: "マーキュリーカップ2026｜盛岡2000mの適性と確認ポイント",
    description:
      "マーキュリーカップ2026の出走馬を、盛岡ダート2000mの高低差、距離実績、斤量、脚質から比較します。中央・地方馬の実績を同じ条件へそろえ、出馬表で確認する順序を整理します。",
    target_keyword: "マーキュリーカップ2026 盛岡2000m コース適性",
    theme_cluster: "race_update",
    category: "重賞攻略",
    article_type: "race_update",
    content_target: "grade_race_article",
    search_intent: "race_profile",
    content_focus: "盛岡ダート2000mの形状と各馬の距離実績を比較する",
    entity_type: "grade_race",
    entity_key: "mercury-cup",
    entity_path: "/articles/grade-races/mercury-cup",
    canonical_path: "/articles/grade-races/mercury-cup",
    pointHeading: "## マーキュリーカップで確認する項目",
  },
  "2026-06-11-jra-news-1d1060ce.md": {
    title: "JRA出馬表の見方｜枠順・馬場・人気を確認する3つの順序",
    description:
      "JRAの出馬表で枠順、馬場、人気をどの順番で確認するかを整理します。馬名やオッズだけで結論を決めず、コース形状、脚質構成、当日の傾向を重ねて比較するための入門ガイドです。",
    target_keyword: "JRA 出馬表 見方 枠順 馬場",
    theme_cluster: "beginner_guide",
    category: "入門ガイド",
    article_type: "beginner_guide",
    content_target: "beginner_guide_article",
    pointHeading: "## 出馬表で確認する3つの順序",
  },
  "2026-06-12-jratraining12-news.md": {
    title: "サウジカップ2026結果回顧｜着順・通過順・走破時計の確認手順",
    description:
      "サウジカップ2026を振り返る際に、着順、通過順、走破時計、展開を分けて確認する手順を整理します。海外競馬の結果を印象だけで判断せず、次走条件へつなげるための見方を紹介します。",
    target_keyword: "サウジカップ2026 結果 回顧",
    theme_cluster: "race_update",
    category: "海外競馬",
    article_type: "race_update",
    content_target: "overseas_race_article",
    pointHeading: "## サウジカップの結果を振り返る確認順",
  },
  "2026-06-19-turf-dirt-news.md": {
    title: "京都競馬場の馬場傾向｜芝の進路と脚質を確認する3項目",
    description:
      "京都競馬場の芝で、内外の進路、4コーナー位置、脚質をどの順番で確認するかを整理します。当日のレース結果を一頭だけで判断せず、複数レースから馬場傾向を捉えるためのコース分析です。",
    target_keyword: "京都競馬場 馬場傾向 コース分析",
    theme_cluster: "course_venue",
    category: "コース分析",
    article_type: "course_venue",
    content_target: "course_venue_article",
    pointHeading: "## 京都の馬場を確認する3つの視点",
  },
  "2026-06-21-news-19d021f2.md": {
    title: "葵ステークス2026出走馬比較｜スピードと脚質を見る5項目",
    description:
      "葵ステークス2026の出走構成を、近走のスピード、先行力、同距離実績、枠順、当日の馬場から比較します。短距離戦で人気や持ち時計だけに偏らず、各馬の条件を整理する手順を紹介します。",
    target_keyword: "葵ステークス2026 出走馬 比較",
    theme_cluster: "race_update",
    category: "重賞攻略",
    article_type: "race_update",
    content_target: "grade_race_article",
    pointHeading: "## 葵ステークスで確認する5項目",
  },
  "2026-06-21-dirttraining-news.md": {
    title: "ユニコーンS2026追い切りの見方｜負荷・反応・間隔を確認する3項目",
    description:
      "ユニコーンS2026の追い切りを、負荷、終いの反応、前走からの間隔に分けて確認します。時計の速さだけで評価を決めず、過程とレース条件を組み合わせるための確認手順です。",
    target_keyword: "ユニコーンS2026 追い切り 確認ポイント",
    theme_cluster: "race_update",
    category: "重賞攻略",
    article_type: "race_update",
    content_target: "grade_race_article",
    pointHeading: "## ユニコーンSの追い切りで確認する3項目",
  },
  "2026-06-22-hanshintrack-condition-news.md": {
    title: "阪神競馬場の馬場傾向｜コース形状と脚質を確認する4項目",
    description:
      "阪神競馬場の馬場傾向を、内外回り、直線の坂、脚質、当日の進路から確認します。コース形状と出馬表を結び付け、開催日の傾向を過不足なく反映するための4項目を整理します。",
    target_keyword: "阪神競馬場 馬場傾向 コース分析",
    theme_cluster: "course_venue",
    category: "コース分析",
    article_type: "course_venue",
    content_target: "course_venue_article",
    pointHeading: "## 阪神の馬場を確認する4項目",
  },
  "2026-06-25-news-1ebdc1e8.md": {
    title: "地方競馬の結果回顧｜展開・馬場・位置取りを確認する順序",
    description:
      "地方競馬の結果を、着順だけでなく展開、馬場、位置取り、走破時計に分けて振り返ります。次走で条件が変わる馬の評価を整理し、出馬表へつなげるための再現可能な確認手順です。",
    target_keyword: "地方競馬 結果回顧 見方",
    theme_cluster: "beginner_guide",
    category: "入門ガイド",
    article_type: "beginner_guide",
    content_target: "beginner_guide_article",
    pointHeading: "## 地方競馬の結果を振り返る確認順",
  },
  "2026-06-27-gdj-news-12370449.md": {
    title: "グランダム・ジャパン古馬シーズン｜結果回顧で見る4つの材料",
    description:
      "グランダム・ジャパン古馬シーズンを、着順、開催場、距離、位置取りの4項目から振り返ります。シリーズ全体の印象だけでなく、各レースの条件差を分けて次走評価へつなげる手順を整理します。",
    target_keyword: "グランダム・ジャパン 古馬シーズン 結果回顧",
    theme_cluster: "race_update",
    category: "重賞攻略",
    article_type: "race_update",
    content_target: "grade_race_article",
    pointHeading: "## シリーズ結果を振り返る4つの材料",
  },
  "2026-07-15-kokuratrack-condition-news.md": {
    title: "小倉競馬場の馬場傾向と障害コース｜出馬表で確認する5項目",
    description:
      "小倉競馬場の芝、ダート、障害コースを分け、出馬表で確認したい5項目を整理します。小回り、直線、起伏、脚質、当日の進路を組み合わせ、条件に合う走り方を比較するためのコース分析です。",
    target_keyword: "小倉競馬場 馬場傾向 障害コース",
    theme_cluster: "course_venue",
    category: "コース分析",
    article_type: "course_venue",
    content_target: "course_venue_article",
    pointHeading: "## 小倉の馬場を確認する5項目",
  },
  "2026-07-18-hakodatetrack-condition-turf-news.md": {
    title: "函館芝の馬場傾向｜時計・脚質・進路を確認する順序",
    description:
      "函館競馬場の芝を、走破時計、脚質、4コーナー位置、直線の進路から確認します。開催日の結果を複数レースで比較し、小回りコースの傾向を出馬表へ反映するための順序を整理します。",
    target_keyword: "函館競馬場 芝 馬場傾向",
    theme_cluster: "course_venue",
    category: "コース分析",
    article_type: "course_venue",
    content_target: "course_venue_article",
    pointHeading: "## 函館芝の傾向を確認する順序",
  },
};

const UNSAFE_SENTENCE_PATTERNS = [
  /netkeiba|日刊スポーツ|スポーツニッポン|スポニチ|サンケイスポーツ|サンスポ|競馬ブック|東京スポーツ|東スポ/i,
  /コラム|外部ニュース|外部ソース|外部情報|外部媒体|信頼媒体|話題の入口|ニュース起点|ニュースを入口/,
  /編集ルール|確認方針|Tavily|出典種別|制作メタ|公式ソース/,
  /本記事では|本稿では/,
  /報道によると|各メディアで|報じられ|によると|ニュース(?:等|で|として)/,
  /推奨馬|推奨買い目|買い目|コメント|取材内容|インタビュー/,
];

const UNSAFE_TABLE_LABELS =
  /信頼媒体|編集ルール|複数ソース整理|外部ソース|外部ニュース|使える事実|データの使い分け|記事の切り口|確認方針|出典種別|媒体名/;

const REMEDIATION_MARKERS =
  /netkeiba|日刊スポーツ|スポーツニッポン|スポニチ|サンケイスポーツ|サンスポ|競馬ブック|東京スポーツ|東スポ|コラム|外部ニュース|外部ソース|外部情報|外部媒体|信頼媒体|内部データ|編集ルール|確認方針|話題の入口|ニュース起点|ニュースを入口|本記事では|本稿では|このニュースの確認ポイント|theme_cluster:\s*news_context|category:\s*競馬ニュース|article_type:\s*news_context|Tavily|陸上競技|箱根駅伝|インカレ|によると|各メディアで|報じられ|ニュース(?:等|で|として)|推奨馬|推奨買い目|コメント|取材内容|インタビュー|ドラマ/i;

function containsUnsafeText(value) {
  return UNSAFE_SENTENCE_PATTERNS.some((pattern) => pattern.test(value));
}

function replaceProductionTerms(value) {
  return value
    .replace(/UMA-FREEの内部データ/g, "UMA-FREEの掲載データ")
    .replace(/UMA-FREE内部データ/g, "UMA-FREE掲載データ")
    .replace(/内部データ/g, "掲載データ")
    .replace(/ニュースで確認された/g, "出馬表で確認できる")
    .replace(/ニュースを受けて/g, "条件を確認すると")
    .replace(/ニュース後/g, "更新後")
    .replace(/ニュース情報/g, "開催情報")
    .replace(/外部ニュース/g, "開催情報")
    .replace(/公式ソース/g, "公式発表")
    .replace(/ドラマ/g, "展開");
}

function removeUnsafeSentences(line) {
  const replaced = replaceProductionTerms(line);
  if (!containsUnsafeText(replaced)) return replaced;

  const prefixMatch = replaced.match(/^(\s*(?:[-*+] |\d+\. ))/);
  const prefix = prefixMatch ? prefixMatch[1] : "";
  const text = prefix ? replaced.slice(prefix.length) : replaced;
  const sentences = text.match(/[^。！？]+[。！？]?/g) || [];
  const kept = sentences.filter((sentence) => !containsUnsafeText(sentence)).join("").trim();
  return kept ? `${prefix}${kept}` : "";
}

function cleanupTableBlocks(lines) {
  const output = [];
  for (let index = 0; index < lines.length; ) {
    if (!/^\s*\|/.test(lines[index])) {
      output.push(lines[index]);
      index += 1;
      continue;
    }

    const block = [];
    while (index < lines.length && /^\s*\|/.test(lines[index])) {
      block.push(lines[index]);
      index += 1;
    }
    const dataRows = block.filter(
      (line, rowIndex) => rowIndex > 1 && !/^\s*\|?\s*:?-{3,}/.test(line),
    );
    if (block.length >= 3 && dataRows.length > 0) output.push(...block);
  }
  return output;
}

function sanitizeBody(content, legacyUpdate) {
  const pointHeading = legacyUpdate?.pointHeading || "## 出馬表で確認するポイント";
  const lines = content.split(/\r?\n/).map((originalLine) => {
    let line = originalLine;
    if (/^##\s+このニュースの確認ポイント\s*$/.test(line)) return pointHeading;
    if (/^\s*\|/.test(line) && UNSAFE_TABLE_LABELS.test(line)) return "";
    line = removeUnsafeSentences(line);
    if (legacyUpdate) line = line.replace(/ニュース/g, "開催情報");
    return line.replace(/[ \t]+$/g, "");
  });

  return cleanupTableBlocks(lines)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeMetadataText(value) {
  if (typeof value !== "string") return value;
  const normalized = value
    .replace(/(?:陣営|厩舎|関係者)?コメント/g, "出走条件")
    .replace(/ニュースの話題を参考にしつつ、?/g, "")
    .replace(/競馬ニュース/g, "競馬情報");
  const cleaned = removeUnsafeSentences(normalized).trim();
  return cleaned;
}

function updateMetadata(data, legacyUpdate) {
  const next = { ...data };
  if (legacyUpdate) {
    for (const [key, value] of Object.entries(legacyUpdate)) {
      if (key !== "pointHeading") next[key] = value;
    }
    next.og_title = legacyUpdate.title;
    next.og_description = legacyUpdate.description;
  }

  for (const key of ["title", "description", "og_title", "og_description", "content_focus"]) {
    if (typeof next[key] === "string") next[key] = sanitizeMetadataText(next[key]);
  }
  if (typeof next.target_keyword === "string") {
    next.target_keyword = sanitizeMetadataText(next.target_keyword);
  }
  if (Array.isArray(next.keywords)) {
    next.keywords = next.keywords
      .map((keyword) => sanitizeMetadataText(String(keyword)))
      .filter((keyword) => keyword && !containsUnsafeText(keyword));
  }
  if (next.category === "競馬ニュース") next.category = legacyUpdate?.category || "入門ガイド";
  if (next.theme_cluster === "news_context") next.theme_cluster = legacyUpdate?.theme_cluster || "beginner_guide";
  if (next.article_type === "news_context") next.article_type = legacyUpdate?.article_type || next.theme_cluster;
  if (next.content_target === "news_article") {
    next.content_target = legacyUpdate?.content_target || `${next.theme_cluster}_article`;
  }
  return next;
}

function main() {
  const articlePaths = fs
    .readdirSync(ARTICLE_DIR)
    .filter((name) => name.endsWith(".md"))
    .sort();
  const changes = [];

  for (const filename of articlePaths) {
    const filePath = path.join(ARTICLE_DIR, filename);
    const source = fs.readFileSync(filePath, "utf8");
    const parsed = matter(source);
    const legacyUpdate = LEGACY_ARTICLE_UPDATES[filename];
    if (!legacyUpdate && !REMEDIATION_MARKERS.test(source)) continue;
    const data = updateMetadata(parsed.data, legacyUpdate);
    const content = sanitizeBody(parsed.content, legacyUpdate);
    const metadataChanged = JSON.stringify(data) !== JSON.stringify(parsed.data);
    const contentChanged = content !== parsed.content.trim();
    if (!metadataChanged && !contentChanged) continue;
    data.last_updated = UPDATED_AT;
    const finalSource = matter.stringify(`${content}\n`, data);
    changes.push(filename);
    if (APPLY) fs.writeFileSync(filePath, finalSource, "utf8");
  }

  console.log(`${APPLY ? "更新" : "更新予定"}: ${changes.length}記事`);
  for (const filename of changes) console.log(`- ${filename}`);
}

main();

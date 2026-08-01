import matter from 'gray-matter';

function parsePositiveIntEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const SEO_RULES = {
  title_min_chars: 30,
  title_max_chars: 50,
  description_min_chars: 120,
  description_max_chars: 160,
  min_word_count: parsePositiveIntEnv('ARTICLE_MIN_BODY_CHARS', 3000),
  require_today_race_cta: true,
  require_buying_point_heading: true,
  require_data_table_or_list: true,
  require_number_in_all_h2: false,
  require_number_in_some_h2: true,
  require_number_in_first_100_chars: true,
  hard_banned_strings: [
    "いかがでしたか",
    "ぜひ参考にしてください",
    "最後まで読んでいただき",
    "必勝",
    "投資",
    "資金配分",
    "期待値",
    "絶対に当たる",
    "絶対的",
    "絶対条件",
    "絶対",
    "完全攻略",
    "最強",
    "買うな",
    "圧倒的",
    "圧倒",
    "狙い撃つ",
    "消去対象",
    "完全に除外",
    "儲かる",
    "儲か",
    "稼げ",
    "爆益",
    "買えば",
    "勝てる",
    "封殺",
    "叩き出",
    "爆発力",
    "断言",
    "論証",
    "解明",
    "無条件",
    "大きなる",
    "暴利設定",
    "馬券購入的価値",
    "利益へ変換",
    "プロやAIシステム",
    "✅",
    "❌",
    // 導入テンプレート
    "と思っていませんか",
    "この記事をお読みいただければ",
    "オカルトや個人の感覚ではなく",
    "曖昧な勘に頼るのではなく",
    // AI手癖
    "結論から言うと",
    "興味深いことに",
    "と言えるでしょう",
    "独自の分析スクリプトで解析",
    "膨大なレースデータを徹底的に解析",
    "https://uma-free.jp",
    // 改善仕様書のNG表現
    "難しいなコース",
    "難しいな展開",
    "大きくに有利",
    "過信を禁物とする",
    "かなり合致している",
    "突出だ。",
    "かなり低い水準",
    "絶望的な低さ",
    "絶望的数値",
    "絶望的",
    "壊滅的",
    // 購入推奨表現
    "厚く張",
    "資金を投下",
    "資金を集中投下",
    "馬券購入資金",
    "購入機会",
    "買い続け",
    // 過剰な確信表現
    "非常に高い",
    "極めて高い",
    "鉄板",
    "間違いない",
    "確実に",
    // 定型的な結び表現
    "データという武器",
    "データという羅針盤",
    "データという根拠",
    "念頭に置いて馬券",
    "以上のことから",
    "勝負気配",
    "ニュース後",
    "ニュース起点",
    "ニュースで",
    "枠順発表前前",
    " of ",
    // 生成記事の公開後レビューで見つかった、読み手に過度な確信や購入誘導を与える表現
    "回収率を高め",
    "回収率向上",
    "妙味の高い穴馬",
    "軸の筆頭",
    "信頼度の高い軸",
    "精度の高い予想",
    "消し",
    "絶好枠",
    "買い目の構築が可能",
    "AI偏差値70以上",
    "偏差値70以上",
    "高い確率で",
    "再現が期待",
    "期待できる",
  ],
};

const REQUIRED_POINT_HEADINGS = [
  'このコースで確認したい判断材料',
  'このレースで確認したい判断材料',
  'この競馬場で確認したい判断材料',
  'この騎手を確認するポイント',
  'このテーマで確認したい判断材料',
];

const REQUIRED_POINT_HEADING_PATTERN = new RegExp(
  `^##\\s+(${REQUIRED_POINT_HEADINGS.join('|')})\\s*$`,
  'm'
);

export interface SEOCheckResult {
  passed: boolean;
  errors: string[];
}

const SOURCE_INDEPENDENCE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /netkeiba|日刊スポーツ|スポーツ報知|スポニチ|サンスポ|デイリースポーツ|東スポ|競馬ブック|競馬ラボ/i,
    reason: '外部メディア名',
  },
  {
    pattern: /コラム|外部ニュース|外部ソース|外部情報|信頼媒体|話題の入口|ニュース起点|ニュースを入口/i,
    reason: '外部記事への依存を示す表現',
  },
  {
    pattern: /内部データ|編集ルール|確認方針|Tavily|出典種別|公式ソース/i,
    reason: '制作工程のメタ表現',
  },
  {
    pattern: /報道によると|各メディアで|報じられ(?:た|て|る)|によると|ニュース(?:等|で|として)/i,
    reason: '引用・報道調の表現',
  },
  {
    pattern: /推奨馬|推奨買い目|第三者コメント|関係者コメント|陣営コメント|厩舎コメント|取材内容|インタビュー/i,
    reason: '第三者の推奨・コメントへの依存',
  },
  {
    pattern: /本記事では|本稿では/i,
    reason: '記事制作を説明する前置き',
  },
  {
    pattern: /ニュース後|ニュース起点/i,
    reason: 'ニュース依存の見出し・構成',
  },
  {
    pattern: /\bof\b/i,
    reason: '日本語文中へ混入した英単語',
  },
];

export function checkSourceIndependence(markdownText: string): SEOCheckResult {
  let parsed;
  try {
    parsed = matter(markdownText);
  } catch {
    return { passed: false, errors: ['Frontmatterのパースに失敗しました。'] };
  }

  const errors: string[] = [];
  const data = parsed.data || {};
  const scanTarget = `${JSON.stringify(data)}\n${parsed.content || ''}`;
  if (String(data.theme_cluster || '') === 'news_context' || String(data.article_type || '') === 'news_context') {
    errors.push('news_contextは公開できません。競馬固有の記事タイプへ再分類してください。');
  }
  if (String(data.category || '') === '競馬ニュース') {
    errors.push('競馬ニュースカテゴリは公開できません。内容に応じた専門カテゴリへ再分類してください。');
  }
  const narVenuePattern = /大井|川崎|船橋|浦和|盛岡|水沢|金沢|笠松|名古屋|園田|姫路|高知|佐賀|門別|帯広/;
  if (String(data.category || '') === '海外競馬' && narVenuePattern.test(scanTarget)) {
    errors.push('海外競馬カテゴリとNAR開催場が矛盾しています。開催区分を確認してください。');
  }
  const duplicatedTerm = scanTarget.match(/(確認|分析|枠順|発表|ニュース|データ|レース|競馬|馬券|騎手|コース|前|後)\1/);
  if (duplicatedTerm) {
    errors.push(`同一語の連続が含まれています: 「${duplicatedTerm[0]}」`);
  }
  for (const { pattern, reason } of SOURCE_INDEPENDENCE_PATTERNS) {
    const match = scanTarget.match(pattern);
    if (match) {
      errors.push(`${reason}が含まれています: 「${match[0]}」`);
    }
  }

  return { passed: errors.length === 0, errors };
}

function collectMarkdownLinks(content: string): string[] {
  const links: string[] = [];
  const linkPattern = /!?\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(content)) !== null) {
    links.push(match[1].replace(/^<|>$/g, ''));
  }

  return links;
}

function normalizeInternalHref(href: string): string | null {
  if (!/^https?:\/\//.test(href)) return href;

  try {
    const url = new URL(href);
    if (url.hostname === 'uma-free.com' || url.hostname === 'www.uma-free.com') {
      return `${url.pathname}${url.search}${url.hash}`;
    }
    return null;
  } catch {
    return href;
  }
}

export function checkSEO(markdownText: string): SEOCheckResult {
  const errors: string[] = [];
  let parsed;

  try {
    parsed = matter(markdownText);
  } catch (e) {
    return { passed: false, errors: ['Frontmatterのパースに失敗しました。Markdownの形式を確認してください。'] };
  }

  const { data, content } = parsed;
  errors.push(...checkSourceIndependence(markdownText).errors);

  const normalizeDateOnly = (value: unknown): string | null => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
  };
  const scheduledRaceDate = normalizeDateOnly(data.scheduled_race_date);
  const articleDate = normalizeDateOnly(data.date) || new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const searchIntent = String(data.search_intent || '');
  const racePhase = String(data.race_phase || '');
  const updateStage = String(data.update_stage || '');
  const entityType = String(data.entity_type || '');
  const entityKey = String(data.entity_key || '');
  const seasonYear = String(data.season_year || '');
  const drawStatus = String(data.draw_status || '');
  const validGradeRaceStages = new Set([
    'field_building',
    'race_week',
    'draw_confirmed',
    'final_48h',
    'race_morning',
    'post_race',
  ]);
  if (entityType === 'grade_race') {
    if (!/^[a-z0-9-]+$/.test(entityKey)) {
      errors.push('重賞記事のentity_keyが未登録または不正です。共有レジストリの英小文字キーが必要です。');
    }
    if (!/^20\d{2}$/.test(seasonYear) || (scheduledRaceDate && !scheduledRaceDate.startsWith(`${seasonYear}-`))) {
      errors.push('重賞記事のseason_yearとscheduled_race_dateが一致していません。');
    }
    if (!validGradeRaceStages.has(updateStage)) {
      errors.push(`重賞記事のupdate_stageが新しい段階管理に一致しません: ${updateStage || '(empty)'}`);
    }
    if (!String(data.schedule_milestone || '').trim()) {
      errors.push('重賞記事にschedule_milestoneがありません。新規URLではなく同一年度記事の段階更新が必要です。');
    }
  }
  if (
    ['draw_confirmed', 'final_48h', 'race_morning'].includes(updateStage)
    && drawStatus !== 'confirmed'
  ) {
    errors.push(`馬番・枠番未確認のためupdate_stage=${updateStage}へ進めません。`);
  }
  if (updateStage === 'post_race' && data.result_confirmed !== true) {
    errors.push('確定結果未確認のためpost_raceへ進めません。');
  }
  if (
    scheduledRaceDate &&
    scheduledRaceDate > articleDate &&
    (searchIntent === 'result_review' || racePhase === 'post_race')
  ) {
    errors.push(
      `開催前のレースを結果回顧として公開できません。scheduled_race_date=${scheduledRaceDate}, article_date=${articleDate}, search_intent=${searchIntent || '(empty)'}, race_phase=${racePhase || '(empty)'}`
    );
  }

  // 空文字はエラー
  if (!content || content.trim() === '') {
    return { passed: false, errors: ['本文が空です。'] };
  }

  // 1. タイトルチェック
  const title = (data.title || '').toString();
  
  // 過去年＋「最新」の混同チェック
  const pastYearLatestPattern = /(?:19\d{2}|20[0-2][0-5])\s*年?\s*(?:度|の)?\s*(?:情報|データ|版)?\s*最新|最新\s*(?:情報|データ|版)?\s*(?:19\d{2}|20[0-2][0-5])\s*年?/i;
  if (pastYearLatestPattern.test(title)) {
    errors.push(`titleに過去の集計年と「最新」が混同した不整合表現が含まれています（例: 【2024年最新】）。集計期間を明示した表現（例: 【2024年データ分析】）に変更してください。`);
  }

  if (title.length < SEO_RULES.title_min_chars) {
    errors.push(`title文字数が不足: 現在${title.length}文字 (最小: ${SEO_RULES.title_min_chars})`);
  }
  if (title.length > SEO_RULES.title_max_chars) {
    errors.push(`title文字数が超過: 現在${title.length}文字 (最大: ${SEO_RULES.title_max_chars})`);
  }
  // Title Format Check: requires at least some numbers and a specific pattern (simplified to checking for numbers for now)
  if (!/\d/.test(title)) {
    errors.push(`titleに数字が含まれていません。(構成ルール: 競馬場/条件＋重要な数字＋読者が取る判断)`);
  }

  // 2. ディスクリプションチェック
  const description = (data.description || '').toString();
  if (pastYearLatestPattern.test(description)) {
    errors.push(`descriptionに過去の集計年と「最新」が混同した不整合表現が含まれています。`);
  }
  if (description.length < SEO_RULES.description_min_chars) {
    errors.push(`description文字数が不足: 現在${description.length}文字 (最小: ${SEO_RULES.description_min_chars})`);
  }
  if (description.length > SEO_RULES.description_max_chars) {
    errors.push(`description文字数が超過: 現在${description.length}文字 (最大: ${SEO_RULES.description_max_chars})`);
  }
  if (description && !/[。.!?！？]$/.test(description.trim())) {
    errors.push(`descriptionが文末記号で終わっていません。検索結果で未完文に見えないよう、1文として閉じてください。`);
  }
  if (/[、,]$|(?:し|照らし|比較し|整理し|確認し)$/.test(description.trim())) {
    errors.push(`descriptionが途中で切れている可能性があります。title/descriptionは検索結果で自然に読める文にしてください。`);
  }

  // 3. 文字数（スペース改行を除くおおまかな文字数。記事タイプに応じて動的判定）
  const themeCluster = (data.theme_cluster || '').toString();
  const articleType = (data.article_type || '').toString();
  
  const configuredMinChars = SEO_RULES.min_word_count;
  let minChars = configuredMinChars; // ARTICLE_MIN_BODY_CHARS を全タイプの下限として扱う
  if (
    themeCluster === 'waku_data' ||
    themeCluster === 'jockey_data' ||
    themeCluster === 'popularity_data' ||
    themeCluster === 'running_style_data' ||
    themeCluster === 'asset' ||
    articleType === 'jockey_data' ||
    articleType === 'popularity_data' ||
    articleType === 'data'
  ) {
    minChars = Math.max(configuredMinChars, 1500); // データ・統計系
  } else if (
    themeCluster === 'grade_race_preview' ||
    themeCluster === 'race_update' ||
    articleType === 'grade_race_preview' ||
    articleType === 'race_update'
  ) {
    minChars = Math.max(configuredMinChars, 2000); // 重賞・ニュース系
  }

  const plainText = content.replace(/\s/g, '');
  if (plainText.length < minChars) {
    errors.push(`本文の文字数が不足: 現在${plainText.length}文字 (最小: ${minChars}文字, タイプ: ${themeCluster || articleType || 'default'})`);
  }

  // 重複文検知（30文字以上の同一文の出現）
  const dupThreshold = Number.parseInt(process.env.ARTICLE_SEO_DUP_CHARS || '30', 10) || 30;
  if (dupThreshold > 0) {
    const lines = content.split('\n');
    const sentences: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      // テーブル行、見出し、空行、箇条書きマーカー等は除外
      if (trimmed.startsWith('|') || trimmed.startsWith('#') || trimmed === '') {
        continue;
      }
      
      const parts = trimmed.split(/[。！？]/);
      for (const part of parts) {
        // スペースや特定のマークダウン記号、括弧類を除去した純粋な文字列長で評価
        const clean = part.replace(/\s/g, '').replace(/[、,.\-\[\]()「」]/g, '');
        if (clean.length >= dupThreshold) {
          sentences.push(clean);
        }
      }
    }
    
    const seen = new Set<string>();
    for (const s of sentences) {
      if (seen.has(s)) {
        errors.push(`本文中に30文字以上の同一文（重複）が検出されました: 「${s.substring(0, 15)}...」`);
        break;
      }
      seen.add(s);
    }
  }

  // 4. レースページへの自然な内部導線
  // 関連記事はフロント側で自動表示するため、本文内の[関連記事：...]プレースホルダーは要求しない。
  // 海外競馬（is_overseas: true または overseas: true または category: '海外競馬'）の場合は /races/today へのリンクは必須としない。
  const isOverseas = data.is_overseas === true || data.overseas === true || data.category === '海外競馬';
  const isGradeRace = String(data.entity_type || '') === 'grade_race';
  if (isGradeRace && content.includes('/races/today')) {
    errors.push('重賞記事の本文に /races/today を含めないでください。検証済みレース導線はページ側で表示します。');
  }
  if (SEO_RULES.require_today_race_cta && !isOverseas && !isGradeRace && !content.includes('/races/today')) {
    errors.push(`今日のAI予想・出馬表への内部リンクがありません。記事末尾に /races/today への自然な導線を含めてください。`);
  }

  if (SEO_RULES.require_buying_point_heading && !REQUIRED_POINT_HEADING_PATTERN.test(content)) {
    errors.push(`記事末尾にテーマに応じた確認ポイントH2がありません。まとめ見出しではなく、判断の箇条書きで締めてください。`);
  }

  // 5. データテーブルまたはリストの存在
  const hasTable = content.includes('|---|') || content.includes('| --- |') || content.includes('|-');
  const hasList = /^[-*・]/m.test(content.replace(/^[ \t]+/gm, '')) || /^\d+\./m.test(content.replace(/^[ \t]+/gm, ''));
  if (SEO_RULES.require_data_table_or_list && !hasTable && !hasList) {
    errors.push(`データテーブルまたはリストが含まれていません。`);
  }

  // 6. 見出し(H2)チェック
  const h2Regex = /^##\s+(.*)$/gm;
  let match;
  let foundH2 = false;
  let nonBuyingH2Count = 0;
  let numberedNonBuyingH2Count = 0;
  while ((match = h2Regex.exec(content)) !== null) {
    foundH2 = true;
    const h2Text = match[1].trim();
    const isRequiredBuyingPointHeading = REQUIRED_POINT_HEADINGS.includes(h2Text);

    if (!isRequiredBuyingPointHeading) {
      nonBuyingH2Count++;
      if (/\d/.test(h2Text)) {
        numberedNonBuyingH2Count++;
      } else if (SEO_RULES.require_number_in_all_h2) {
        errors.push(`H2見出しに数字が含まれていません: 「${h2Text}」`);
      }
    }

    if (h2Text === 'まとめ') {
      errors.push(`「まとめ」というH2見出しが存在します。(作成禁止)`);
    }
    if (h2Text === '総論' || h2Text === 'おわりに') {
      errors.push(`「${h2Text}」というH2見出しが存在します。(作成禁止)`);
    }
  }

  if (!foundH2) {
    errors.push(`H2見出しが存在しません。見出しに数字または具体的な条件を含めてください。`);
  }

  if (SEO_RULES.require_number_in_some_h2 && nonBuyingH2Count > 0 && numberedNonBuyingH2Count === 0) {
    errors.push(`主要H2のうち少なくとも1つには、勝率・距離・枠番などの具体的な数字を含めてください。`);
  }

  // 7. 冒頭100文字以内の数字チェック
  if (SEO_RULES.require_number_in_first_100_chars) {
    const first100 = plainText.substring(0, 100);
    if (!/\d/.test(first100)) {
      errors.push(`本文の冒頭100文字以内に数字が含まれていません。(1文目で核心データを提示してください)`);
    }
    const pastYearLatestPattern = /(?:19\d{2}|20[0-2][0-5])\s*年?\s*(?:度|の)?\s*(?:情報|データ|版)?\s*最新|最新\s*(?:情報|データ|版)?\s*(?:19\d{2}|20[0-2][0-5])\s*年?/i;
    if (pastYearLatestPattern.test(first100)) {
      errors.push(`本文の冒頭100文字以内に過去の集計年と「最新」が混同した不整合表現が含まれています。`);
    }
  }

  // 8. 記事の末尾チェック（まとめ・総論・戦略の復唱禁止）
  const endingForbiddenPatterns = [
    /鍵となる。?$/,
    /実現する。?$/,
    /ぜひ.*参考に.*$/,
    /見逃せない。?$/,
    /いかがでしたか。?$/,
    /注目だ。?$/,
    /戦略に組み込む/,
    /効率的.*構築/,
    /馬券戦略においては/,
    /回収率向上に繋がる。?$/,
    /積極的に狙うことが/
  ];
  const lastLineMatch = content.trim().match(/([^\n]+)$/);
  if (lastLineMatch) {
    const lastLine = lastLineMatch[1];
    const isForbiddenEnding = endingForbiddenPatterns.some(pattern => pattern.test(lastLine));
    if (isForbiddenEnding) {
      errors.push(`記事の末尾が定型文や過剰な総括で終わっています（「...${lastLine.substring(Math.max(0, lastLine.length - 15))}」）。テーマに応じた確認ポイントで締めてください。`);
    }
  }

  // 9. 手動関連記事や壊れたリンク片のチェック
  if (/^##\s+関連記事\s*$/m.test(content)) {
    errors.push(`本文内に手動の「関連記事」セクションがあります。関連記事はページ側で自動表示するため、本文には含めないでください。`);
  }

  if (/^\s*\(\/[^)\s]+\)\s*$/m.test(content)) {
    errors.push(`本文内に壊れたリンク片があります。単独行の「(/course-xxx)」のようなURL片を削除してください。`);
  }

  for (const href of collectMarkdownLinks(content)) {
    if (href.includes('uma-free.jp')) {
      errors.push(`リンクのドメインが古いです: ${href}。正規ドメイン https://uma-free.com を使ってください。`);
      continue;
    }

    const internalHref = normalizeInternalHref(href);
    if (internalHref === null) {
      errors.push(`生成記事内の外部リンクは原則禁止です: ${href}`);
      continue;
    }

    if (!internalHref.startsWith('/')) {
      errors.push(`相対リンクは禁止です: ${href}`);
      continue;
    }

    const pathname = internalHref.split(/[?#]/)[0];
    if (pathname.startsWith('/articles/')) {
      errors.push(`本文内に手動の記事リンクがあります: ${href}。関連記事はページ側で自動表示してください。`);
      continue;
    }

    if (pathname.startsWith('/races/')) {
      if (
        pathname === '/races/today' ||
        /^\/races\/\d{4}-\d{2}-\d{2}$/.test(pathname) ||
        /^\/races\/\d{4}-\d{2}-\d{2}\/[a-z0-9%.-]+\/\d{1,2}$/.test(pathname)
      ) {
        continue;
      }
      errors.push(`レースページへのリンク形式が不正です: ${href}`);
      continue;
    }

    errors.push(`生成記事内で許可されていない内部リンクです: ${href}`);
  }

  // 10. NGワードの完全チェック
  const scanTarget = `${title}\n${description}\n${content}`;
  for (const banned of SEO_RULES.hard_banned_strings) {
    const found = banned === '買うな'
      ? /買うな(?!ら)/.test(scanTarget)
      : scanTarget.includes(banned);

    if (found) {
      errors.push(`title/description/本文にNGワードが含まれています: 「${banned}」`);
    }
  }

  return {
    passed: errors.length === 0,
    errors
  };
}

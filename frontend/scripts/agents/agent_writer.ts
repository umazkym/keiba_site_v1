import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ARTICLE_LLM_MODELS, getArticleLlmStrategySummary, getGeminiModelTiers } from './model_tiers';
import { GeminiQuotaExceededError, reserveGeminiRequest } from './gemini_quota';
import {
  classifyGeminiFailure,
  GeminiFailureKind,
  isApiKeyInvalidError,
  isRetryableGeminiError,
} from './gemini_failure';

// APIキーは環境変数から取得

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function findLastBuyingPointHeading(content: string): number {
  const pattern = /^##\s+(このコースで確認したい判断材料|このレースで確認したい判断材料|この競馬場で確認したい判断材料|この騎手を確認するポイント|このテーマで確認したい判断材料|このコースの買い目ポイント|このレースの買い目ポイント|このコースの確認ポイント|このレースの確認ポイント|この競馬場の確認ポイント|このテーマの確認ポイント)\s*$/gm;
  let match: RegExpExecArray | null;
  let lastIndex = -1;
  while ((match = pattern.exec(content)) !== null) {
    lastIndex = match.index;
  }
  return lastIndex;
}


export type WriterEvidenceFact = {
  text: string;
  origin: 'official' | 'uma_free';
};

export type WriterEvidence = {
  facts: WriterEvidenceFact[];
  metrics: Array<{ label: string; value: string | number; origin: 'uma_free' }>;
  as_of: string;
};

export type WriteOrder = {
  operation?: 'create' | 'rewrite' | 'grade_race_search_repair';
  rewrite_target_slug?: string;
  target_keyword: string;
  theme_cluster: string;
  entity_type?: string;
  entity_key?: string;
  entity_key_source?: string;
  race_identity_version?: string;
  race_circuit?: string;
  entity_archive_slug?: string;
  season_year?: string | number;
  entity_path?: string;
  canonical_path?: string;
  content_target?: string;
  research_sources?: {
    source_url: string;
    source_name: string;
    source_type: 'official' | 'trusted_media' | 'reference' | 'other';
    fetched_at: string;
    title: string;
    allowed_claims: string[];
  }[];
  reference_data: {
    period: string;
    condition: string;
    sample_size: number;
    key_metrics: Record<string, string | number>[];
    source?: string;
    writer_evidence?: WriterEvidence;
    article_type?: string;
    news_topic?: string;
    news_reason?: string;
    search_intent?: string;
    search_intent_label?: string;
    search_angle_label?: string;
    query_intents?: string[];
    source_race_entity_key?: string;
    scheduled_race_date?: string;
    repair_alert_types?: string[];
    gsc_repair_report_path?: string;
    draw_status?: string;
    draw_confirmed?: boolean;
    calendar_race?: string;
    days_to_race?: number;
    matched_race?: Record<string, string | number | null>;
    predictions?: Record<string, string | number>[];
    course_stats?: Record<string, string | number>[];
    horse_number_advantages?: Record<string, string | number>[];
    topic_bridge?: Record<string, unknown>;
    entity_type?: string;
    entity_key?: string;
    entity_key_source?: string;
    race_identity_version?: string;
    race_circuit?: string;
    entity_archive_slug?: string;
    season_year?: string | number;
    entity_path?: string;
    canonical_path?: string;
    content_target?: string;
    ai_analysis_text?: string;
    source_cards?: {
      source_url: string;
      source_name: string;
      source_type: 'official' | 'trusted_media' | 'reference' | 'other';
      fetched_at: string;
      title: string;
      allowed_claims: string[];
    }[];
    [key: string]: unknown;
  };
  competing_article_structure?: string[];
  related_articles?: { title: string; slug: string }[];
  priority?: number;
  has_predictions?: boolean;
};

const WRITER_HIDDEN_REFERENCE_KEYS = new Set([
  'source',
  'source_cards',
  'source_urls',
  'schedule_source_url',
  'external_research_required',
  'external_research_queries',
  'external_research_query',
  'news_topic',
  'news_topic_key',
  'news_reason',
  'db_enrichment_error',
]);

const WRITER_HIDDEN_METRIC_ORIGIN_PATTERN = /信頼媒体|編集ルール|複数ソース整理|外部ソース|trusted[_ -]?media|external|reference|other/i;
const WRITER_HIDDEN_METRIC_LABEL_PATTERN = /外部ソース|使える事実|データの使い分け|記事の切り口/i;
const WRITER_HIDDEN_METRIC_FIELD_PATTERN = /^(?:出典(?:種別)?|参照元|参照URL|媒体(?:名|URL)?|制作(?:情報|メタ)|origin|provenance|source(?:[_-].*)?|url|media(?:[_-].*)?|meta(?:data)?(?:[_-].*)?|fetched_at)$/i;
const WRITER_UNSAFE_VALUE_PATTERN = /https?:\/\/|netkeiba|日刊スポーツ|スポーツ報知|スポニチ|サンスポ|デイリースポーツ|東スポ|競馬ブック|競馬ラボ|外部ニュース|外部ソース|信頼媒体|編集ルール|Tavily|推奨馬|推奨買い目|コメント/i;

function normalizeWriterMetricValue(value: unknown): string | number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

function sanitizeKeyMetricRow(item: unknown): Record<string, string | number> | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const row = item as Record<string, unknown>;
  const origin = [
    row['出典種別'],
    row.origin,
    row.provenance,
    row.source_type,
  ].map(value => String(value || '').trim()).filter(Boolean).join(' ');

  if (WRITER_HIDDEN_METRIC_ORIGIN_PATTERN.test(origin)) return null;

  const label = String(row['確認項目'] || row.label || '').trim();
  const normalizedValue = normalizeWriterMetricValue(row['内容'] ?? row.value);
  if (label && normalizedValue !== null) {
    if (WRITER_HIDDEN_METRIC_LABEL_PATTERN.test(label)) return null;
    if (WRITER_UNSAFE_VALUE_PATTERN.test(`${label} ${normalizedValue}`)) return null;
    return { label, value: normalizedValue };
  }

  const sanitizedRow: Record<string, string | number> = {};
  for (const [rawKey, rawValue] of Object.entries(row)) {
    const key = rawKey.trim();
    if (!key || WRITER_HIDDEN_METRIC_FIELD_PATTERN.test(key)) continue;

    const value = normalizeWriterMetricValue(rawValue);
    if (value === null) continue;
    if (WRITER_HIDDEN_METRIC_LABEL_PATTERN.test(key)) continue;
    if (WRITER_UNSAFE_VALUE_PATTERN.test(`${key} ${value}`)) continue;
    sanitizedRow[key] = value;
  }

  return Object.keys(sanitizedRow).length > 0 ? sanitizedRow : null;
}

function sanitizeWriterEvidence(value: unknown): WriterEvidence | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const facts = Array.isArray(raw.facts)
    ? raw.facts
      .map(item => {
        const row = item as Record<string, unknown>;
        const origin = String(row?.origin || '');
        const text = String(row?.text || '').trim();
        if (!text || (origin !== 'official' && origin !== 'uma_free')) return null;
        if (WRITER_UNSAFE_VALUE_PATTERN.test(text)) return null;
        return { text, origin } as WriterEvidenceFact;
      })
      .filter((item): item is WriterEvidenceFact => item !== null)
    : [];
  const metrics = Array.isArray(raw.metrics)
    ? raw.metrics
      .map(item => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const rawOrigin = String(row.origin || row['出典種別'] || '').toLowerCase();
        const origin = /uma[_ -]?free|内部/.test(rawOrigin) ? 'uma_free' : rawOrigin;
        const label = String(row.label || row['確認項目'] || '').trim();
        const value = row.value ?? row['内容'];
        const normalizedValue = typeof value === 'number' ? value : String(value || '').trim();
        if (origin !== 'uma_free' || !label || normalizedValue === '') return null;
        if (WRITER_UNSAFE_VALUE_PATTERN.test(`${label} ${normalizedValue}`)) return null;
        return { label, value: normalizedValue, origin: 'uma_free' as const };
      })
      .filter((item): item is { label: string; value: string | number; origin: 'uma_free' } => item !== null)
    : [];
  const asOf = String(raw.as_of || '').trim();
  if (facts.length === 0 && metrics.length === 0) return undefined;
  return { facts, metrics, as_of: asOf };
}

/**
 * 媒体名や検索経路などの制作情報をLLMへ渡さず、公開文に使える事実だけへ絞る。
 * 元のWriteOrderは監査ログとFact Checkerで使うため変更しない。
 */
export function buildWriterFacingOrder(order: WriteOrder): WriteOrder {
  const referenceData: Record<string, unknown> = { ...order.reference_data };
  for (const key of WRITER_HIDDEN_REFERENCE_KEYS) {
    delete referenceData[key];
  }

  const keyMetrics = Array.isArray(referenceData.key_metrics)
    ? referenceData.key_metrics
      .map(sanitizeKeyMetricRow)
      .filter((item): item is Record<string, string | number> => item !== null)
    : [];
  referenceData.key_metrics = keyMetrics;

  const topicBridge = referenceData.topic_bridge;
  if (topicBridge && typeof topicBridge === 'object') {
    const bridge = topicBridge as Record<string, unknown>;
    referenceData.topic_bridge = {
      writer_focus: bridge.writer_focus,
      primary_search_intent: bridge.primary_search_intent,
      avoid_overuse: bridge.avoid_overuse,
    };
  }

  const writerEvidence = sanitizeWriterEvidence(referenceData.writer_evidence);
  if (writerEvidence) {
    referenceData.writer_evidence = writerEvidence;
  } else {
    delete referenceData.writer_evidence;
  }

  return {
    ...order,
    operation: order.operation || 'create',
    research_sources: undefined,
    reference_data: referenceData as WriteOrder['reference_data'],
  };
}

const SYSTEM_PROMPT = `あなたは競馬データメディア「UMA-FREE」の編集ライターだ。
与えられたJSONデータをもとに、Markdown形式の記事を執筆する。

【記事の役割】
- 検索から来た読者には「この条件で何を重く見るべきか」をすぐ掴ませる。
- 予想ページを繰り返し見る読者には、出馬表を見る前の判断メモとして使える内容にする。
- 重賞記事では、公式日程、開催までの日数、reference_data.search_intent に合わせて主題を1つ定める。コース、出走構成、前走、交流重賞の条件差、結果回顧など、選ばれた主題を深く扱う。
- 平場向けの記事では、全頭を深く見られない読者に「確認を優先するレース」と「慎重に見るレース」を分ける初期判断を渡す。
- 公式の開催情報を扱う記事でも、発表元の紹介ではなく、レース・コース・騎手など競馬固有の主題から書き始める。
- 地方競馬・交流重賞の記事では、中央競馬と同じ書き方に寄せすぎず、開催場、ナイター、馬場、距離、交流重賞なら中央馬と地方馬の条件差を「確認順」として整理する。
- 入力に「Gemma SEO/構成ブリーフ」が含まれる場合は、検索意図・見出し候補・不足観点のメモとして使う。ただし新しい数値や事実の根拠にはしない。
- 煽り、断定しすぎ、機械的なSEO文は避ける。数字を根拠に、競馬ファンが自然に読める実務的な文章にする。

【書き方の原則（重要）】
- 1文目から核心データを提示し、読者が取るべき確認順序を示す。挨拶・趣旨説明・問いかけは書かない。
- 数字を出したら、必ず「馬券検討ではどう扱うか」まで落とし込み、「これが何を意味するか（例：3回走れば2回以上は馬券圏内に入る水準など）」を読者の理解を助けるために一言添える。
- 文末は原則として曖昧に逃げない。ただし母数が少ない、差が小さい、回収率だけが突出している場合は「軸にはしにくい」「相手候補まで」といった抑制を入れる。
- 前回と同じ見出し構成・同じ文の流れにしない。坂、直線、コーナー、スタート位置、開催時期など、条件固有の要素を1つ以上絡める。
- 「当たる」「儲かる」と読ませる文章ではなく、「買い方の優先順位が整理できる」文章にする。
- 読者を急かす文ではなく、直前に迷った時のチェックリストとして残る文章にする。
- 「[キーワード]を買う前は」のように検索語をそのまま接続した文は禁止。「出馬表を見る前は」「データを見る時は」など自然な言い方に直す。
- titleやdescriptionでは、同じ判断語や途中で切れた文を繰り返さない。特に「勝率、回収率、枠順や騎手の傾向を照らし」のような未完文は禁止。

【文面品質とトーン・表現のルール（改訂版）】

■ 冒頭の書き方
- 1文目は「このコースは〇〇だ。」「〇〇枠が有利になる。」など、
  事実+結論の形で始める
- 「今回は〜について解説します」「この記事では〜」は使わない
- 問いかけ形（「〜ではないでしょうか？」）も禁止

■ 文末パターンの多様化（重要）
同じ文末が2文連続したら別のパターンに変える：
  断定形：「〜だ」「〜になる」「〜を示す」
  提示形：「〜を確認したい」「〜が目安になる」
  示唆形：「〜という構造が見えてくる」「〜という話になる」
  行動形：「〜から先に見る」「〜を出馬表で確認する」

■ 「かなり」の使用制限
1記事あたり3回以内。超えそうなら以下に言い換える：
  かなり高い → 顕著に高い / 際立って高い / 高水準の
  かなり低い → 大幅に低い / 著しく低い
  かなり有利 → 明確に有利 / 数値上の優位がある

■ セクション見出しの多様化（同じパターン禁止）
同一記事内で「〜が示す」はH2/H3合わせて2回まで。
代わりに以下を使い分ける：
  数値提示型：「入力済みデータで差が出ている枠同士の比較」
  問題提起型：「なぜ内枠人気馬が崩れるのか」
  行動提示型：「枠順発表後に最初に確認すること」
  対比型：「良馬場と道悪で変わる先行馬の評価」

■ データの見せ方
数値が3つ以上並ぶ場合は必ずMarkdownテーブルにする。
リスト（- の箇条書き）だけで数値を羅列しない。

■ 禁止する結び方
以下の締め文は使わない：
  「〜を念頭に置いて馬券を組み立てたい」
  「〜が重要なポイントとなる」
  「ぜひ〜を活用してほしい」
  「以上のことから〜と言える」
  「データという武器を手に〜」
代わりに：具体的な条件や次の確認行動で終わる
  例：「先行馬が多い日は差し馬の浮上余地を先に見る。当日は /races/today で確認できる。」


【検索結果での見え方】
- titleは数字だけで目を引かせない。検索ユーザーがクリック前に判断できるよう、「見方」「違い」「確認順」「評価を下げたい条件」「相手候補」「慎重に見る条件」など、記事で解決する行動を1つ入れる。
- 馬体重、馬場状態、控除率、騎手の得意コースなど一般クエリ寄りのテーマでは、titleの前半に読者の検索語に近い言葉を置き、後半に数字やデータの強みを置く。
- descriptionは「この記事を読むと何ができるか」を1文で閉じる。検索語の羅列、未完文、同じ語尾の連発、「確認できます」の連続は禁止。
- PC検索ではtitleの前半だけで比較されるため、「データ分析」「徹底解説」だけで終わらせず、評価を上げる材料・慎重に見る条件・当日の確認順序のいずれかを明示する【禁止事項】
- 「まとめ」「総論」「おわりに」の見出しは禁止。記事種別に合う中立的な「確認したい判断材料」で締める。
- 以下の表現が含まれる場合、書き直せ:
  ・「〜と思っていませんか？」「この記事をお読みいただければ〜」
  ・「結論から言うと」「興味深いことに」「総じて〜」「〜に注目です」
  ・「絶対」「絶対的」「確実」「必勝」「完全攻略」「最強」「圧倒的」「狙い撃つ」「買うな」「消去対象」「いかがでしたか？」「ぜひ参考にしてください」
  ・過去の集計年（2024年など）と「最新」という言葉を近接させて混同した表記（例：\`【2024年最新】\` などの年号表記。代わりに \`【2024年データ分析】\` や \`2024年集計\` 等を使用すること）
- ✅ や ❌ などの装飾記号は使わない。競馬の印（◎○▲△）は重賞攻略系の予想データに限って使用可。
- 【本文内リンクの扱い】記事末尾に「関連記事」セクションを作ることは禁止する（ページ側が自動表示するため重複する）。「[関連記事：ダミー]」のようなプレースホルダーも禁止。
  - ただし入力の related_articles にスラッグが提示されている場合は、本文の文脈に自然に馴染む箇所へ2〜3本だけリンクしてよい。形式は \`[アンカーテキスト](/articles/{slug})\`。
  - リンクできるのは related_articles に列挙されたスラッグだけ。そこにないスラッグを推測して書くと404になるため絶対に禁止する。
  - アンカーテキストは相手記事のタイトルをそのまま貼らず、その場の文脈で読者が知りたくなる言葉にする（例:「中山ダート1200mの枠順傾向」）。
  - 「詳しくはこちら」「関連記事はこちら」のような内容の分からないアンカーテキストは使わない。
  - 同じスラッグへ2回以上リンクしない。1つの段落に2本以上のリンクを詰め込まない。
  - 文脈が合うリンクが無ければ0本でよい。関連性の薄いリンクを数合わせで入れることは禁止する。
- 馬名、過去実績（例: どのレースを勝ったか）、対戦成績、個別の脚質（逃げ・差しなど）など、入力である WriteOrder に明記されていない馬の個別事実は絶対に捏造・記述してはならない。WriteOrder に個別馬情報が含まれていない場合は、馬個人のことには一切言及せず、競馬場やコース等のマクロデータ（全体傾向・統計情報）の解説のみに徹底すること。
- 自分で勝率、回収率、母数、枠順別成績、斤量別成績、脚質別成績、AI偏差値を補完・推測・生成してはならない。
- 勝率、複勝率、連対率、好走率、単勝回収率、複勝回収率などのパーセンテージ（%）は、reference_data に明示されている値だけを使用する。根拠がない場合は、数値を出さず「出馬表ページで確認する」「当日のデータで確認する」と表現する。
- reference_data.predictions が空、または has_predictions が false の場合、AI偏差値の具体値、AI偏差値70以上のようなしきい値、上位・下位の断定、予想印（◎○▲△）は書かない。「枠順発表後に出馬表ページで確認する」に留める。
- AI偏差値や予想印が入力にある場合でも、「軸の筆頭」「信頼度の高い軸」「精度の高い予想」「消し」のような強い表現は使わず、「候補として確認」「相手候補」「評価を下げたい条件」に言い換える。
- データテーブルを作る場合は、入力JSONに存在する列名と値を使う。入力にない列を足さない。入力にない行を増やさない。
- 入力に枠順別・脚質別・斤量別の実数がない場合、そのテーブルは作らない。「未取得」「枠順発表後に確認」など、分かる範囲の定性的な説明に留める。
- reference_data.course_stats が空で key_metrics も空の場合は、レース名・開催日・会場・条件など、入力にある事実だけを小さな確認表にする。
- 数値の見栄えを良くするための丸め、線形補完、平均値の作成は禁止。必要な計算は、入力にすでに計算済みの値がある場合だけ使う。
- 「過去3年」などの期間表現は reference_data.period に従う。period がない場合は期間を断定しない。
- reference_data.writer_evidence.facts は公式情報から独立確認した事実、metrics はUMA-FREEの掲載数値として扱う。入力にない事実や数値は補わない。
- 媒体名、コラム名、外部記事の紹介、引用、第三者の推奨馬や買い目は本文へ書かない。入力に混入していても使用しない。
- 公式事実を使う場合も「公式発表によると」の紹介調を繰り返さず、確認済みの開催条件として簡潔に記述する。
- theme_cluster が "race_update" の場合、reference_data.key_metrics は確認済みの事実テーブルとして扱う。表にない日付・頭数・発表内容を勝手に補完しない。
- reference_data.search_intent_label がある場合、その検索意図だけを記事の中心に置く。「レース条件」なら開催場・距離・コース形態、「出走構成」なら距離適性・相手関係・斤量・ローテーション、「中央馬と地方馬」なら所属、コース経験、輸送、距離適性、「結果回顧」なら確定結果、展開、位置取り、事前評価との差を扱う。
- reference_data.topic_bridge.avoid_overuse に語がある場合、その語を独立したH2へ広げず、主題との接点が確認できる時だけ短く触れる。特に search_intent が "waku" でない記事で枠順を、"training" でない記事で追い切りを定型的に追加しない。
- reference_data.race_phase が "post_race" の場合、記事は結果・回顧として書く。「枠順発表後に確認」「最終追い切りを見る」などレース前へ戻る構成は禁止する。
- reference_data.draw_status が "confirmed" でない場合、「枠順確定」「枠順が確定した今」「枠順が発表されたことで」「枠順が決まった今」など、枠順発表済みと読める表現は禁止する。「枠順発表前」「枠順発表後に確認する材料」「出馬表で確認する順番」に留める。
- reference_data.topic_bridge がある場合は writer_focus に沿って主題を一つに絞り、関係の薄い論点を定型的に追加しない。
- frontmatter の search_intent、race_phase、scheduled_race_date、content_focus には、reference_data の同名値と topic_bridge.writer_focus を省略せずコピーする。Editorが主題を維持するために使う。
- WriteOrder または reference_data に entity_type、entity_key、entity_key_source、race_identity_version、race_circuit、entity_archive_slug、season_year、entity_path、canonical_path、content_target がある場合は、frontmatterへ同じ値を省略せずコピーする。重賞名・コース名・年度をまたいでSEO評価を集約するための管理情報なので、本文の都合で書き換えない。
- reference_data.predictions、course_stats、horse_number_advantages、ai_analysis_text、matched_race がある場合、それらは掲載データとして扱い、「内部データ」「制作方針」のような読者に不要な説明は書かない。
- reference_data.days_to_race がある場合、開催までの日数に合わせて書く。開催前なら「直前に確認する順番」、開催後なら「次に同条件を見る時の確認材料」に寄せる。

【フォーマット要件】
- タイトル：厳格に28文字以上、42文字以内。
  - 【最重要】狙いキーワード（target_keyword の中心となる語）は、必ずタイトルの先頭12文字以内に含める。日本語の検索結果では概ね先頭30文字前後しか表示されないため、狙いの語が後半にあると検索画面で見えなくなる。
  - 構成: 「[狙いキーワード] ＋ [狙い方の核心] ｜ [補足]」
  - 例: 「京都芝1400mの枠順傾向｜3枠を軸にしやすい理由」
  - 例: 「新潟2歳S2026の出走構成｜芝1600mで見る比較材料」
  - \`｜\` より後ろには補足情報だけを置く。狙いキーワードを \`｜\` の後ろに置いてはならない。
  - NG例: 「データで読み解く2026年の傾向｜新潟2歳S出走構成」（狙いの語が後半にあり検索画面で切れる）
  - NG例: 「京都芝1400mは枠順別の数値だけで決まる」（数字の羅列だけで読者の判断に繋がらない）
  - 禁止事項: 過去の集計データ年（2024年など）と「最新」という言葉を近接させて混同した表記（例：\`【2024年最新】\`）は機械チェックで即却下されるため【絶対に禁止】する。タイトル、ディスクリプション、本文のいずれにおいてもこのような混同表現を用いてはならない。
  - 代替許容表現: 過去の集計期間であることを明示したフォーマット（例：\`【2024年データ分析】\`、\`2024年集計\`、\`2024年実績\`など）を必ず使用すること。
- ディスクリプション：120〜160文字。
  - 読者が検索前に抱いている疑問を1つ、疑問形（「〜はどこか」「〜は何が違うか」）または「〜を確認できる」の形で必ず含める。検索結果でクリックするかどうかは、この一文が自分の疑問と一致するかで決まる。
  - その上で「この記事を読むと何ができるか」を明示して閉じる。
  - 検索語の羅列、未完文、同じ語尾の連発は禁止。「確認できます」を2回以上使わない。
  - タイトル同様、過去の集計年と「最新」の混同表記は【絶対に禁止】する。
- 見出し（H2・H3）：数字を含む見出しを最低1つ入れる。ただし全見出しを「3つの〜」に寄せない。同じ語尾の見出しを繰り返さない。
- 枠順別のデータ等は見やすくするため、【必ず1つ以上のMarkdown形式のデータテーブル】（| で区切る表）にすること。リスト代用は不可。ただし表の数値は入力JSONに存在する値だけを使う。
- 数値を使う場合は期間・条件・母数を必ず明記する。
- 本文3,400〜4,200字を目安にし、最低3,000字は必ず超える。ただし水増し禁止。短くなりそうな場合は、入力データから読み取れる「扱い方」「慎重に見る条件」「当日の確認順序」「サンプル数が少ない場合の注意点」「検索読者が次に調べる観点」を具体化して厚みを出す。
- 生成後に本文量を自分で確認し、3,000字未満になりそうなら、架空の数値や外部情報を足さず、「出馬表で見る順番」「人気馬を慎重に見る条件」「相手候補に残す前の確認順」「評価を下げる条件」「直前に確認する材料」のうち不足している観点を追加する。
- 重賞記事（entity_type が "grade_race"）では、本文中に /races/today や個別レースCTAを生成しない。検証済みレース導線はページ側で表示する。常設記事だけ、本文中のCTAに /races/today を使用できる。存在確認できないURLや仮のURLは書かない。

【よくある質問セクション ― 締めの見出しの直前に必須】
締めの「確認したい判断材料」見出しの【直前】に、\`## よくある質問\` を1つ置く。記事の末尾に置いてはならない。
- 質問は \`### \` 見出しで3問。読者が検索窓に打ち込みそうな短い疑問文にする（例: \`### 新潟芝1600mは内枠が有利ですか？\`）。
- 各回答は2〜3文。本文ですでに扱った内容と入力データの範囲だけで答える。
- 【重要】このセクションで新しい数値を出してはならない。パーセンテージ、頭数、回収率などは、本文中に既出で reference_data に根拠がある値だけを再掲する。根拠がない場合は数値を使わず「出馬表ページで確認する」と答える。
- 「はい、そうです」だけで終わる回答や、質問を言い換えただけの回答は禁止する。読者が次に取る行動が分かる形で閉じる。
- 質問を水増しして4問以上にしない。3問固定とする。

【記事の締め方 ― 確認ポイントセクション必須】
記事の最後のセクションは、theme_clusterに応じて以下の見出しで締める。
- "race_update" または "grade_race_preview": ## このレースで確認したい判断材料
- "course_venue": ## この競馬場で確認したい判断材料
- "jockey_profile": ## この騎手を確認するポイント
- "beginner_guide": ## このテーマで確認したい判断材料
- それ以外: ## このコースで確認したい判断材料
内容: 「確認」「相手候補」「慎重」「条件付き」のような自然なラベルで、読者がすぐ使える判断基準を3〜5個提示。必要な場合だけ「買い目に含める候補」という控えめな表現を使い、「軸」「消し」は避ける。
例:
  - 確認: 入力済みデータで安定している枠は、出馬表では先に脚質を確認したい。
  - 相手候補: 人気とのズレが出やすい先行馬は、相手候補として残す材料になる。
  - 慎重: 評価を下げたい条件に当てはまる人気馬は、馬場と展開を合わせて確認する。
  - 条件付き: 内で脚をためられる先行馬だけ拾う。
数値がない項目には数字を付け足さず、「確認」「相手候補」「慎重」「条件付き」の判断ラベルで整理する。
その後、以下の1文で記事を閉じる:
常設記事だけ「最新の出馬表とAI予想は [今日のAI予想・出馬表](/races/today) で無料公開中。」を使用する。重賞記事ではこの文を出力しない。

【禁止事項】
- 「まとめ」「総論」「おわりに」の見出しは禁止。代わりに記事種別に合う確認材料の見出しで締める。
- 以下の表現が含まれる場合、書き直せ:
  ・「〜と思っていませんか？」「この記事をお読みいただければ〜」
  ・「結論から言うと」「興味深いことに」「総じて〜」「〜に注目です」
  ・「絶対」「絶対的」「確実」「必勝」「完全攻略」「最強」「圧倒的」「狙い撃つ」「買うな」「消去対象」「いかがでしたか？」「ぜひ参考にしてください」
- ✅ や ❌ などの装飾記号は使わない。競馬の印（◎○▲△）は重賞攻略系の予想データに限って使用可。
- 【本文内リンクの扱い】記事末尾に「関連記事」セクションを作ることは禁止する（ページ側が自動表示するため重複する）。「[関連記事：ダミー]」のようなプレースホルダーも禁止。
  - ただし入力の related_articles にスラッグが提示されている場合は、本文の文脈に自然に馴染む箇所へ2〜3本だけリンクしてよい。形式は \`[アンカーテキスト](/articles/{slug})\`。
  - リンクできるのは related_articles に列挙されたスラッグだけ。そこにないスラッグを推測して書くと404になるため絶対に禁止する。
  - アンカーテキストは相手記事のタイトルをそのまま貼らず、その場の文脈で読者が知りたくなる言葉にする（例:「中山ダート1200mの枠順傾向」）。
  - 「詳しくはこちら」「関連記事はこちら」のような内容の分からないアンカーテキストは使わない。
  - 同じスラッグへ2回以上リンクしない。1つの段落に2本以上のリンクを詰め込まない。
  - 文脈が合うリンクが無ければ0本でよい。関連性の薄いリンクを数合わせで入れることは禁止する。

【テーマクラスター別の追加指示】
入力データのtheme_clusterの値に応じて書き方を微調整する。
・"asset"/"waku_data": 枠順データの記事。枠番ごとの勝率テーブルを提示し、「買い」と「評価を下げる」枠を明確にする。
・"seasonal": 開催シーズン中の時事性を強調する枠順・傾向記事。
・"jockey_data": 騎手のコース成績記事。「勝率は高いが回収率は低い」等の人気とのズレを掘り下げる。
・"popularity_data": 配当傾向と上位人気の信頼度。「堅いコースか荒れるコースか」を明確にする。
・"running_style_data": コース形態と脚質の有利不利。直線距離や坂の有無を根拠にする。
・"course_venue": 競馬場単位のコース分析記事。距離ごとに別記事化せず、reference_data.key_metrics の各距離を表で整理し、短距離・マイル・中距離・長距離の確認順を1本の記事内で分ける。出馬表で当日確認する順番へ接続する。
・"jockey_profile": 騎手分析記事。リーディング表の勝率・連対率・3着内率を入口にし、得意コースや近況は writer_evidence と入力データの範囲で扱う。特定騎手を「信頼できる」と断定せず、人気時に慎重に見る条件と相手候補に残す条件を分ける。
・"beginner_guide": 入門ガイド記事。競馬初心者がレースページを見る前に迷いやすい順番を整理する。専門用語を増やしすぎず、最後は /races/today で確認できる操作に自然につなげる。
・"grade_race_preview": 重賞レースのプレビュー記事。以下のルールに従う:
  - タイトル構成: 「[レース名][年]｜[競馬場・距離]で確認したい材料」（30〜50文字）。検索語としてレース名、年、開催場、距離またはコース種別を前半に自然に入れる。
  - G1・Jpn1・G2・Jpn2・G3・Jpn3・その他重賞はいずれも新規URLを乱立させず、同じ重賞記事を「枠順発表後」「当日朝更新」「結果回顧」の段階で育てる前提で書く。
  - frontmatterには update_stage を入れる。値は field_building / race_week / draw_confirmed / final_48h / race_morning / post_race のいずれか。
  - reference_data.seo_keywords または WriteOrder.keywords がある場合、frontmatter.keywords に5〜10件を自然な検索タグとしてコピーする。レース名、年、競馬場、距離、枠順、出馬表、結果回顧など、入力にある語だけを使う。
  - update_stage が post_race、または search_intent が result_review の場合は、既存記事を結果確定後に更新する記事として書く。レース前の確認順へ戻さず、確定着順、展開の見直し、事前評価との差、次走へ残す材料を、reference_data.results と key_metrics の範囲だけで整理する。
  - 追記更新を想定し、古い判断を消すのではなく「どの条件なら評価を上げるか」「どの条件なら見送るか」を更新後も読み返せる形にする。
  - 導入: レースの基本情報（開催場・コース・距離）を1〜2文で簡潔に。
  - コース傾向セクション必須: reference_data のデータから傾向をMarkdownテーブルで提示。
  - 予測データがある場合: 偏差値上位の馬を印（◎○▲△）付きで分析。
  - 予測データがない場合: コース傾向と過去データに絞って記述。「最新のAI偏差値・AI予想印は枠順発表後に出馬表ページで無料公開されます」と一文添え、reference_data.race_url のリンクを配置。
  - 読者は直前の不安解消を求めている。人気馬を煽るのではなく、慎重に見る条件・評価を上げる材料・見送りを検討する条件を分けて書く。
  - 重賞記事で禁止する表現パターン：
    「〜騎手が乗るなら信頼できる」（主観）
    「〜の仕上がりは抜群」（根拠なし）
    「過去の実績から〜は鉄板」（確実性の断定）
  代わりに使う表現：
    「〇〇コースでの複勝率が〇〇%なので、
     同条件なら候補として確認したい」
    「前走から条件が変わる点として〜がある」
・"race_update": 公式の開催条件と掲載データから既存の重賞・日別レース導線へつなぐ記事。以下のルールに従う:
  - タイトル構成: 「[レース名][年]｜直前に見る確認ポイント[数字]」（30〜50文字）
  - reference_data.search_intent と competing_article_structure にないレース前キーワードをSEO目的で追加しない。枠順、追い切り、馬場を一律に並べず、選ばれた主題を深く掘り下げる。
  - reference_data.entity_type が "grade_race" の場合は重賞カレンダー記事として扱う。タイトルとkeywordsには、レース名、年、競馬場、距離またはコース種別を自然に含める。
  - update_stage が draw_confirmed の場合は、枠順発表後に出馬表で何を確認するかを中心にする。枠順そのものが入力にない場合は、枠順別の有利不利を断定せず、枠順と脚質・馬場を照合する手順に留める。
  - update_stage が post_race、または search_intent が result_review の場合は、重賞の結果確定後更新として書く。reference_data.results にない着順、通過順、不利、コメントを補わず、確定結果とコース・距離条件から見直す材料を整理する。
  - reference_data.predictions、course_stats、horse_number_advantages がある場合、数値同士を直前に確認する順序として接続する。
  - 地方競馬の重賞・交流重賞では、開催場名（大井、川崎、船橋、浦和、門別、園田、高知、佐賀、帯広など）、ナイター、馬場、距離、交流重賞の条件差を自然に含める。中央G1風の煽り見出しに寄せない。
  - 最新情報を断定しない。重賞記事のレース導線はページ側で検証後に表示するため、本文へ /races/today を置かない。
  - 最後の見出しは「## このレースで確認したい判断材料」にする。

【カテゴリの決定ルール】
theme_clusterの値に応じてcategoryを以下のように決定する。
  - "asset" -> "コース分析"
  - "seasonal" -> "コース分析"
  - "waku_data" -> "コース分析"
  - "jockey_data" -> "騎手分析"
  - "jockey_profile" -> "騎手分析"
  - "popularity_data" -> "馬券・統計"
  - "running_style_data" -> "コース分析"
  - "course_venue" -> "コース分析"
  - "beginner_guide" -> "入門ガイド"
  - "grade_race_preview" -> "重賞攻略"
  - "race_update" -> "重賞攻略"

【出力形式】
説明文・謝辞・前置きは不要。以下のFrontmatter付きMarkdownのみを出力する。

---
title: ""
description: ""
keywords: []
target_keyword: ""
theme_cluster: ""
category: ""
article_type: ""
update_stage: ""
draw_status: ""
search_intent: ""
race_phase: ""
scheduled_race_date: ""
content_focus: ""
entity_type: ""
entity_key: ""
entity_key_source: ""
race_identity_version: ""
race_circuit: ""
entity_archive_slug: ""
season_year: ""
entity_path: ""
canonical_path: ""
content_target: ""
draft: true
---

（本文）
`;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function geminiRetryAttemptsForModel(modelName: string): number {
  if (/gemma/i.test(modelName)) return 1;
  return Math.min(3, parsePositiveInt(process.env.ARTICLE_LLM_RETRY_ATTEMPTS, 2));
}

function geminiRetryDelayMs(requestAttempt: number): number {
  const baseMs = parsePositiveInt(process.env.ARTICLE_LLM_RETRY_BASE_MS, 12000);
  return Math.min(45000, baseMs * requestAttempt);
}

function logGeminiUsage(prefix: string, response: any): void {
  const usage = response?.usageMetadata;
  if (!usage) {
    console.log(`${prefix} token usage: usageMetadata unavailable`);
    return;
  }

  const promptTokens = usage.promptTokenCount ?? 'unknown';
  const outputTokens = usage.candidatesTokenCount ?? 'unknown';
  const totalTokens = usage.totalTokenCount ?? 'unknown';
  console.log(`${prefix} token usage: input=${promptTokens} output=${outputTokens} total=${totalTokens}`);
}

type ArticleStrategyBrief = {
  primary_search_intent: string;
  title_angles: string[];
  section_plan: string[];
  expansion_angles: string[];
  long_tail_terms: string[];
  fact_guardrails: string[];
  internal_link_flow: string[];
};

const STRATEGY_BRIEF_SYSTEM_PROMPT = `あなたはUMA-FREEの記事戦略担当だ。
WriteOrderを読み、検索流入を増やすための構成ブリーフをJSONだけで返す。

【役割】
- reference_data.search_intent、race_phase、scheduled_race_date を最優先し、開催段階に合う検索意図を深掘りする。枠順・追い切りを全記事共通の構成要素にしない。
- 検索エンジンで上位表示されるため、ターゲットキーワードに基づき、検索需要が高い関連キーワード（ロングテールキーワード）を抽出し、それらを自然に配置するための構成案を作成する。
- 本文を厚くし、情報価値（一次情報としての独自データ分析）を高めるための安全な追加観点を提案する。
- ただし、入力JSONにない数値、馬名、成績、外部事実は絶対に作らない。
- 煽り、過剰な断定、購入を強く促す表現は避ける。

【出力JSON】
{
  "primary_search_intent": "検索ユーザーがこの記事で解決したい具体的な悩みや疑問を1文で書く",
  "title_angles": ["30〜50文字のタイトルで、ターゲットキーワードを含みつつ、クリックされやすい自然な切り口を3件"],
  "section_plan": ["検索流入を最大化するためのH2見出し候補を5〜7件。最低2件は具体的な数値や条件を含める"],
  "expansion_angles": ["3,000字以上にするため、選ばれた検索意図を深掘りできる安全な分析・比較の観点を5件"],
  "long_tail_terms": ["主題と直接関係し、本文や見出しに自然に含めたい検索語を5〜10件。枠順・追い切りは主題の場合だけ含める"],
  "fact_guardrails": ["捏造を避け、正確なデータのみを提示するための注意点を3〜5件"],
  "internal_link_flow": ["重賞記事はページ側の検証済みレース導線へ任せ、常設記事だけ /races/today へ自然につなぐための観点を2〜3件"]
}`;

function toStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback;
  return value
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 10);
}

function normalizeStrategyBrief(value: any): ArticleStrategyBrief {
  return {
    primary_search_intent: String(value?.primary_search_intent || '').trim(),
    title_angles: toStringArray(value?.title_angles),
    section_plan: toStringArray(value?.section_plan),
    expansion_angles: toStringArray(value?.expansion_angles),
    long_tail_terms: toStringArray(value?.long_tail_terms),
    fact_guardrails: toStringArray(value?.fact_guardrails),
    internal_link_flow: toStringArray(value?.internal_link_flow),
  };
}

function parseJsonObject(text: string): any {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON object not found in strategy response.');
    return JSON.parse(match[0]);
  }
}

async function buildArticleStrategyBrief(order: WriteOrder, genAI: GoogleGenerativeAI): Promise<ArticleStrategyBrief | null> {
  const modelTiers = getGeminiModelTiers('GEMINI_STRATEGY_MODEL_TIERS');
  const prompt = `以下のWriteOrderから、検索流入と記事の厚みを増やすための構成ブリーフを作る。\n\n${JSON.stringify(order, null, 2)}`;

  for (const currentModelName of modelTiers) {
    try {
      console.log(`[Strategy] Trying model: ${currentModelName}`);
      const model = genAI.getGenerativeModel({
        model: currentModelName,
        systemInstruction: STRATEGY_BRIEF_SYSTEM_PROMPT,
        generationConfig: {
          temperature: 0.2,
          topP: 0.75,
          responseMimeType: 'application/json',
        },
      });

      await reserveGeminiRequest({
        scope: 'article',
        model: currentModelName,
        purpose: 'strategy-brief',
        target: order.target_keyword,
      });
      const result = await model.generateContent(prompt);
      logGeminiUsage(`[Strategy] ${currentModelName}`, result.response);
      const text = result.response.text() || '';
      const brief = normalizeStrategyBrief(parseJsonObject(text));
      if (!brief.primary_search_intent && brief.section_plan.length === 0) {
        throw new Error('Strategy brief was empty.');
      }
      console.log(`[Strategy] Brief created: sections=${brief.section_plan.length} expansion=${brief.expansion_angles.length}`);
      return brief;
    } catch (e: any) {
      if (isApiKeyInvalidError(e)) {
        console.error(`\n[CRITICAL ERROR] GEMINI_API_KEY が無効、または漏洩判定されています。`);
        console.error(`Google AI Studioで新しいAPIキーを再生成し、.env または GitHub Secrets の GEMINI_API_KEY に設定し直してください。\n`);
        throw e;
      }
      if (e instanceof GeminiQuotaExceededError) {
        console.warn(`[Strategy Warning] ${currentModelName} quota guard: ${e.message}`);
        if (e.kind === 'total') return null;
        continue;
      }
      console.warn(`[Strategy Warning] ${currentModelName} failed: ${e.message || String(e)}`);
      if (classifyGeminiFailure(e) === 'billing_depleted') {
        throw e;
      }
      if (!isRetryableGeminiError(e)) {
        continue;
      }
    }
  }

  console.warn('[Strategy] 構成ブリーフの生成に失敗したため、WriteOrderのみで初稿を生成します。');
  return null;
}

async function expandDraftWithGemma(
  order: WriteOrder,
  currentText: string,
  neededChars: number,
  genAI: GoogleGenerativeAI
): Promise<string | null> {
  const modelName = ARTICLE_LLM_MODELS.efficient; // RPD 500の高効率モデルを固定で使用
  const SYSTEM_PROMPT = `あなたは競馬データメディア「UMA-FREE」の編集ライターだ。
与えられた現在の記事ドラフトとWriteOrderに基づき、記事の文字数を増やしつつ品質と専門性を高めるために、新たなH2セクション（見出しと詳細な解説本文）を1〜2件追加執筆する。

【執筆のルール】
1. 絶対に架空の数値、成績、馬名などを捏造しない。WriteOrder.reference_dataに明記されている実データ（勝率、複勝率、回収率など）のみを数値根拠として使用すること。データがない場合は、reference_data.search_intent と topic_bridge.writer_focus に沿う定性的な比較・確認手順を詳しく述べる。
2. 読者が「出馬表で何を確認すべきか」「どのような条件なら評価を上げる/下げるか」という実務的なチェック手順にフォーカスして執筆する。
3. 当日の具体的なオッズ数値や人気の動きについて、予測・断定するような記述（例：「当日は〇〇番人気になる」「オッズは〇〇倍程度」など）は絶対に記述しないこと。具体的な数値を使わず、「人気とのズレ」「オッズの妙味」といった定性的な線引きや、コース固有の普遍的な特徴、出馬表を確認する手順のみに追記を制限すること。
4. 煽り表現（「最強」「絶対」「必勝」など）や、AI特有の手癖表現（「いかがでしたか」「今回は〜について解説します」「興味深いことに」など）は一切禁止。
5. Markdown形式の適切なH2（##）とH3（###）で記述する。
6. search_intent が "waku" でない場合は枠順を、"training" でない場合は追い切りを新しいH2の主題にしない。race_phase が "post_race" の場合はレース前の確認手順へ戻さない。
7. 出力は、追加するセクションのMarkdownテキストのみとすること。前置きや説明は不要。`;

  const prompt = `以下の現在の記事ドラフトとWriteOrder情報に基づき、記事を補強する新しい詳細なH2セクションを執筆してください。
追加するセクションは、現在のドラフトの「締めセクション（## このコースで確認したい判断材料 / ## このレースで確認したい判断材料 / ## この競馬場で確認したい判断材料 / ## この騎手を確認するポイント / ## このテーマで確認したい判断材料）」の直前に安全に挿入できるような構成にしてください。

目標追加文字数: 約 ${neededChars} 文字

【現在の記事ドラフト】
\`\`\`markdown
${currentText}
\`\`\`

【WriteOrder】
${JSON.stringify(order, null, 2)}
`;

  try {
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
      }
    });

    await reserveGeminiRequest({
      scope: 'article',
      model: modelName,
      purpose: 'writer-dynamic-expansion',
      target: order.target_keyword,
    });

    const response = await model.generateContent(prompt);
    logGeminiUsage(`[Writer-Expansion] ${modelName}`, response.response);
    let addition = response.response.text() || '';
    
    // Markdownマーカーの除去
    addition = addition.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '').trim();
    if (!addition) return null;

    // 締めセクションの直前に挿入する
    const headingIndex = findLastBuyingPointHeading(currentText);
    if (headingIndex < 0) {
      return `${currentText.trim()}\n\n${addition}`.trim();
    }

    const before = currentText.slice(0, headingIndex).trim();
    const after = currentText.slice(headingIndex).trim();
    return `${before}\n\n${addition}\n\n${after}`.trim();
  } catch (err: any) {
    console.error(`[Writer-Expansion Error] ${err.message}`);
    throw err;
  }
}

function cleanWriterPromptEchoesAndMeta(markdownText: string): string {
  let targetText = markdownText.replace(/\r\n/g, '\n');
  
  // 複数フロントマターのクリーンアップ
  const fmBlocks = targetText.split('---');
  if (fmBlocks.length > 3) {
    let targetFmIndex = -1;
    for (let i = fmBlocks.length - 2; i >= 0; i--) {
      const block = fmBlocks[i];
      if (block.includes('title:') && block.includes('description:')) {
        targetFmIndex = i;
        break;
      }
    }
    if (targetFmIndex !== -1) {
      console.log(`[Writer-Cleanup] Duplicate frontmatters detected. Filtering garbage meta.`);
      const actualFm = fmBlocks[targetFmIndex].trim();
      const actualBody = fmBlocks.slice(targetFmIndex + 1).join('---').trim();
      targetText = `---\n${actualFm}\n---\n\n${actualBody}`;
    }
  }

  // 本文からのオウム返し除去
  const lines = targetText.split('\n');
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    const isEcho = 
      trimmed.includes('3,000字以上') ||
      trimmed.includes('4,200字目安') ||
      trimmed.includes('競馬データメディア「UMA-FREE」の編集ライター') ||
      trimmed.includes('検索ユーザーに「何を重く見るべきか」を提示') ||
      (trimmed.includes('race_update') && trimmed.includes('（')) ||
      (trimmed.includes('news_context') && trimmed.includes('（')) ||
      (trimmed.includes('grade_race_preview') && trimmed.includes('（')) ||
      (trimmed.startsWith('* ') && (
        trimmed.includes('AI予想・偏差値などの内部データ') ||
        trimmed.includes('predictions:') ||
        trimmed.includes('JRAが調教後馬体重を発表') ||
        trimmed.includes('構成案：') ||
        trimmed.includes('導入：') ||
        trimmed.includes('タイトル：') ||
        trimmed.includes('ディスクリプション：') ||
        trimmed.includes('文末の多様化') ||
        trimmed.includes('「かなり」の使用制限') ||
        trimmed.includes('見出しの多様化') ||
        trimmed.includes('Markdownテーブルの使用') ||
        trimmed.includes('禁止表現')
      ));
    return !isEcho;
  });

  return filteredLines.join('\n');
}

function normalizeDraftDrawMetadata(markdownText: string, order: WriteOrder): string {
  const drawStatus = String(order.reference_data?.draw_status || '');
  if (!drawStatus) return markdownText;

  try {
    const parsed = matter(markdownText);
    parsed.data.draw_status = drawStatus;
    if (
      drawStatus !== 'confirmed'
      && ['draw_confirmed', 'final_48h', 'race_morning'].includes(String(parsed.data.update_stage || ''))
    ) {
      parsed.data.update_stage = 'race_week';
    }
    return matter.stringify(`${parsed.content.trim()}\n`, parsed.data);
  } catch {
    return markdownText;
  }
}

function normalizeDraftCalendarMetadata(markdownText: string, order: WriteOrder): string {
  const ref = order.reference_data || {};
  const updateStage = String(ref.update_stage || '').trim();
  const scheduleMilestone = String(ref.schedule_milestone || '').trim();
  const scheduleMilestones = String(ref.schedule_milestones || '').trim();
  const searchIntent = String(ref.search_intent || '').trim();
  const racePhase = String(ref.race_phase || '').trim();
  const scheduledRaceDate = String(ref.scheduled_race_date || '').trim();
  const raceName = String(ref.race_name || ref.calendar_race || '').trim();
  const scheduledVenue = String(ref.scheduled_venue || '').trim();
  const matchedRace = ref.matched_race && typeof ref.matched_race === 'object'
    ? ref.matched_race as Record<string, unknown>
    : {};
  const raceId = String(matchedRace.race_id || '').trim();
  const raceUrl = String(matchedRace.race_url || ref.race_url || '').trim();
  const raceNumber = Number.parseInt(String(matchedRace.race_number || ''), 10);
  const keywordCandidates = [
    ...(Array.isArray((order as any).keywords) ? (order as any).keywords : []),
    ...(Array.isArray(ref.seo_keywords) ? ref.seo_keywords : []),
    ...(Array.isArray(ref.keywords) ? ref.keywords : []),
  ]
    .map((keyword) => String(keyword || '').trim())
    .filter(Boolean);

  if (!updateStage && keywordCandidates.length === 0 && !searchIntent && !racePhase && !scheduledRaceDate) {
    return markdownText;
  }

  try {
    const parsed = matter(markdownText);
    if (updateStage) parsed.data.update_stage = updateStage;
    if (scheduleMilestone) parsed.data.schedule_milestone = scheduleMilestone;
    if (scheduleMilestones) parsed.data.schedule_milestones = scheduleMilestones;
    if (searchIntent) parsed.data.search_intent = searchIntent;
    if (racePhase) parsed.data.race_phase = racePhase;
    if (scheduledRaceDate) parsed.data.scheduled_race_date = scheduledRaceDate;
    if (raceName) parsed.data.race_name = raceName;
    if (scheduledVenue) parsed.data.scheduled_venue = scheduledVenue;
    if (raceId) parsed.data.race_id = raceId;
    if (/^\/races\/\d{4}-\d{2}-\d{2}\/[a-z0-9%.-]+\/\d{1,2}$/.test(raceUrl)) parsed.data.race_url = raceUrl;
    if (Number.isInteger(raceNumber) && raceNumber > 0) parsed.data.race_number = raceNumber;
    parsed.data.race_bridge_enabled = false;
    if (ref.result_confirmed === true) parsed.data.result_confirmed = true;
    if (keywordCandidates.length > 0) {
      const existing = Array.isArray(parsed.data.keywords)
        ? parsed.data.keywords.map((keyword: unknown) => String(keyword || '').trim()).filter(Boolean)
        : [];
      const merged: string[] = [];
      for (const keyword of [...existing, ...keywordCandidates]) {
        if (!keyword || merged.includes(keyword)) continue;
        merged.push(keyword);
        if (merged.length >= 10) break;
      }
      parsed.data.keywords = merged;
    }
    return matter.stringify(`${parsed.content.trim()}\n`, parsed.data);
  } catch {
    return markdownText;
  }
}

function orderMetadataValue(order: WriteOrder, key: keyof WriteOrder): string {
  const topLevelValue = order[key];
  const referenceValue = order.reference_data?.[String(key)];
  const raw = topLevelValue ?? referenceValue ?? '';
  return String(raw).trim();
}

function normalizeCanonicalPath(value: string): string {
  if (!value.startsWith('/')) return '';
  if (!/^\/(grade-races|courses|jockeys|articles)\//.test(value)) return '';
  return value.replace(/\/+$/, '');
}

function normalizeDraftEntityMetadata(markdownText: string, order: WriteOrder): string {
  const entityType = orderMetadataValue(order, 'entity_type');
  const entityKey = orderMetadataValue(order, 'entity_key');
  const entityKeySource = orderMetadataValue(order, 'entity_key_source');
  const raceIdentityVersion = orderMetadataValue(order, 'race_identity_version');
  const raceCircuit = orderMetadataValue(order, 'race_circuit');
  const entityArchiveSlug = orderMetadataValue(order, 'entity_archive_slug');
  const seasonYear = orderMetadataValue(order, 'season_year');
  const contentTarget = orderMetadataValue(order, 'content_target');
  const entityPath = normalizeCanonicalPath(orderMetadataValue(order, 'entity_path'));
  const canonicalPath = normalizeCanonicalPath(orderMetadataValue(order, 'canonical_path'));

  if (
    !entityType
    && !entityKey
    && !entityKeySource
    && !raceIdentityVersion
    && !raceCircuit
    && !entityArchiveSlug
    && !seasonYear
    && !contentTarget
    && !entityPath
    && !canonicalPath
  ) {
    return markdownText;
  }

  try {
    const parsed = matter(markdownText);
    if (entityType) parsed.data.entity_type = entityType;
    if (entityKey) parsed.data.entity_key = entityKey;
    if (entityKey && entityType === 'grade_race') parsed.data.race_entity_key = entityKey;
    if (entityKeySource) parsed.data.entity_key_source = entityKeySource;
    if (raceIdentityVersion) parsed.data.race_identity_version = raceIdentityVersion;
    if (raceCircuit) parsed.data.race_circuit = raceCircuit;
    if (entityArchiveSlug) parsed.data.entity_archive_slug = entityArchiveSlug;
    else if (entityType === 'grade_race') delete parsed.data.entity_archive_slug;
    if (seasonYear) parsed.data.season_year = seasonYear;
    if (contentTarget) parsed.data.content_target = contentTarget;
    if (entityPath) parsed.data.entity_path = entityPath;
    if (canonicalPath) parsed.data.canonical_path = canonicalPath;
    if (entityType === 'grade_race' && entityKeySource === 'deterministic_schedule' && !entityArchiveSlug) {
      delete parsed.data.entity_path;
      delete parsed.data.canonical_path;
    }
    return matter.stringify(`${parsed.content.trim()}\n`, parsed.data);
  } catch {
    return markdownText;
  }
}

/**
 * ライターエンジンを実行し、指定されたWriteOrderに基づいて記事ドラフトを生成する
 */
export async function generateDraft(order: WriteOrder): Promise<{
  success: boolean;
  filePath?: string;
  error?: string;
  retryable?: boolean;
  apiKeyInvalid?: boolean;
  failureKind?: GeminiFailureKind;
}> {
  let retryableFailure = false;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { success: false, error: "GEMINI_API_KEY is not set." };
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelTiers = getGeminiModelTiers('GEMINI_WRITER_MODEL_TIERS');
    console.log(`[Writer] LLM strategy: ${getArticleLlmStrategySummary()}`);

    const writerOrder = buildWriterFacingOrder(order);
    const strategyBrief = await buildArticleStrategyBrief(writerOrder, genAI);
    const strategySection = strategyBrief
      ? `\n\n【Gemma SEO/構成ブリーフ】\n${JSON.stringify(strategyBrief, null, 2)}`
      : '';
    const prompt = `以下の入力データ（WriteOrder）に基づいて記事を生成する。${strategySection}\n\n【WriteOrder】\n${JSON.stringify(writerOrder, null, 2)}`;
    console.log(`[Writer] Generating draft for keyword: ${order.target_keyword}...`);
    console.log(`[Writer] Prompt size estimate: system=${SYSTEM_PROMPT.length} chars order_prompt=${prompt.length} chars`);

    let result;
    let usedModel = '';
    let lastErrorMessage = '';
    
    for (let i = 0; i < modelTiers.length; i++) {
        const currentModelName = modelTiers[i];
        console.log(`[Writer] Trying model: ${currentModelName}`);
        
        const model = genAI.getGenerativeModel({
          model: currentModelName,
          systemInstruction: SYSTEM_PROMPT,
          generationConfig: {
            temperature: 0.7,
            topP: 0.8,
            topK: 40,
          }
        });

        const maxRequestAttempts = geminiRetryAttemptsForModel(currentModelName);
        for (let requestAttempt = 1; requestAttempt <= maxRequestAttempts; requestAttempt++) {
          try {
            await reserveGeminiRequest({
              scope: 'article',
              model: currentModelName,
              purpose: 'writer',
              target: order.target_keyword,
            });
            result = await model.generateContent(prompt);
            usedModel = currentModelName;
            console.log(`[Writer] Model succeeded: ${usedModel}`);
            logGeminiUsage(`[Writer] ${usedModel}`, result.response);
            break; // 成功したら抜ける
          } catch (e: any) {
            if (isApiKeyInvalidError(e)) {
                console.error(`\n[CRITICAL ERROR] GEMINI_API_KEY が無効、または漏洩判定されています。`);
                console.error(`Google AI Studioで新しいAPIキーを再生成し、.env または GitHub Secrets の GEMINI_API_KEY に設定し直してください。\n`);
                throw e;
            }
            if (e instanceof GeminiQuotaExceededError) {
                console.error(`[Writer Warning] ${currentModelName} quota guard: ${e.message}`);
                if (e.kind === 'total' || i === modelTiers.length - 1) {
                    throw e;
                }
                break;
            }
            console.error(`[Writer Warning] ${currentModelName} failed: ${e.message}`);
            lastErrorMessage = e.message || String(e);
            if (classifyGeminiFailure(e) === 'billing_depleted') {
                throw e;
            }
            if (isRetryableGeminiError(e)) {
                retryableFailure = true;
                if (requestAttempt < maxRequestAttempts) {
                    const waitMs = geminiRetryDelayMs(requestAttempt);
                    console.warn(`[Writer] ${currentModelName} retryable failure. Retrying in ${waitMs}ms (${requestAttempt + 1}/${maxRequestAttempts})...`);
                    await sleep(waitMs);
                    continue;
                }
            }
            if (i === modelTiers.length - 1) {
                throw new Error(`すべての生成モデルでの試行が失敗しました。${lastErrorMessage}`);
            }
            break;
          }
        }
        if (result) {
            break;
        }
    }

    // すべてのモデルで失敗またはクォータ制限になった場合の Gemma フォールバック
    if (!result) {
      console.log(`[Writer] All default model tiers failed or quota exceeded. Attempting automatic fallback (${ARTICLE_LLM_MODELS.reserve})...`);
      const fallbackModel = ARTICLE_LLM_MODELS.reserve;
      const model = genAI.getGenerativeModel({
        model: fallbackModel,
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: {
          temperature: 0.7,
          topP: 0.8,
          topK: 40,
        }
      });
      try {
        await reserveGeminiRequest({
          scope: 'article',
          model: fallbackModel,
          purpose: 'writer-fallback-gemma',
          target: order.target_keyword,
        });
        result = await model.generateContent(prompt);
        usedModel = fallbackModel;
        console.log(`[Writer] Fallback to Gemma succeeded: ${usedModel}`);
        logGeminiUsage(`[Writer-Fallback] ${usedModel}`, result.response);
      } catch (fallbackErr: any) {
        console.error(`[Writer Fatal] Gemma fallback also failed: ${fallbackErr.message}`);
        if (classifyGeminiFailure(fallbackErr) === 'billing_depleted') {
          throw fallbackErr;
        }
        throw new Error(`すべての生成モデルおよびGemmaフォールバックでの試行が失敗しました。${fallbackErr.message}`);
      }
    }

    let text = result?.response.text();

    if (!text) {
      throw new Error("生成されたテキストが空でした。");
    }

    // Markdownのコードブロックマーカー(```markdown)がAIの癖で出力された場合は除去する
    text = text.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
    text = normalizeDraftDrawMetadata(text, order);
    text = normalizeDraftCalendarMetadata(text, order);
    text = normalizeDraftEntityMetadata(text, order);
    console.log(`[Writer] Draft length: ${text.replace(/\s/g, '').length} chars`);

    // Gemmaによる動的拡張
    // 記事タイプ別の目安は残しつつ、ARTICLE_MIN_BODY_CHARS を下回らないようにする。
    const configuredMinChars = parsePositiveInt(process.env.ARTICLE_MIN_BODY_CHARS, 3000);
    let minChars = configuredMinChars;
    const themeCluster = order.theme_cluster || '';
    const articleType = order.reference_data?.article_type || '';
    
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

    const plainLen = text.replace(/\s/g, '').length;

    if (plainLen < minChars) {
      console.log(`[Writer] Draft length (${plainLen} chars) is below target (${minChars} chars). Expanding dynamically with Gemma...`);
      try {
        const expandedText = await expandDraftWithGemma(writerOrder, text, minChars - plainLen, genAI);
        if (expandedText) {
          text = expandedText;
          console.log(`[Writer] Expanded draft length: ${text.replace(/\s/g, '').length} chars`);
        }
      } catch (err: any) {
        console.error(`[Writer Warning] Gemma expansion failed, proceeding with original draft: ${err.message}`);
      }
    }

    // 一時ディレクトリ (pending) に保存
    const now = new Date();
    // YYYYMMDD_HHmmss フォーマットの文字列を作成
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;

    // パス: frontend/agents/queue/pending
    const queueDir = path.join(__dirname, '..', '..', 'agents', 'queue', 'pending');

    // ディレクトリが存在しない場合は作成
    fs.mkdirSync(queueDir, { recursive: true });

    let filePath = path.join(queueDir, `${timestamp}.md`);
    let suffix = 2;
    while (fs.existsSync(filePath)) {
      filePath = path.join(queueDir, `${timestamp}_${suffix}.md`);
      suffix++;
    }

    // プロンプトオウム返しの除去と複数フロントマターのクリーンアップ
    text = cleanWriterPromptEchoesAndMeta(text);
    text = normalizeDraftDrawMetadata(text, order);
    text = normalizeDraftCalendarMetadata(text, order);
    text = normalizeDraftEntityMetadata(text, order);

    fs.writeFileSync(filePath, text, 'utf-8');

    console.log(`[Writer] Draft successfully saved to: ${filePath}`);

    return { success: true, filePath };

  } catch (error: any) {
    console.error(`[Writer Error] ${error.message}`);
    const apiKeyInvalid = isApiKeyInvalidError(error);
    const failureKind = classifyGeminiFailure(error);
    return {
      success: false,
      error: error.message,
      retryable: !apiKeyInvalid && (retryableFailure || error instanceof GeminiQuotaExceededError || isRetryableGeminiError(error)),
      apiKeyInvalid,
      failureKind,
    };
  }
}

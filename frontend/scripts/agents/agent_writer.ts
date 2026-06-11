import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getArticleLlmStrategySummary, getGeminiModelTiers } from './model_tiers';
import { GeminiQuotaExceededError, reserveGeminiRequest } from './gemini_quota';

// APIキーは環境変数から取得

function isApiKeyInvalidError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error || '');
  return /API key was reported as leaked|API_KEY_INVALID|API key not valid|Forbidden|403/i.test(msg);
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function findLastBuyingPointHeading(content: string): number {
  const pattern = /^##\s+(このコースの買い目ポイント|このレースの買い目ポイント|このニュースの確認ポイント)\s*$/gm;
  let match: RegExpExecArray | null;
  let lastIndex = -1;
  while ((match = pattern.exec(content)) !== null) {
    lastIndex = match.index;
  }
  return lastIndex;
}


export type WriteOrder = {
  target_keyword: string;
  theme_cluster: string;
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
    source: string;
    article_type?: string;
    news_topic?: string;
    news_reason?: string;
    search_intent?: string;
    search_intent_label?: string;
    search_angle_label?: string;
    calendar_race?: string;
    days_to_race?: number;
    matched_race?: Record<string, string | number | null>;
    predictions?: Record<string, string | number>[];
    course_stats?: Record<string, string | number>[];
    horse_number_advantages?: Record<string, string | number>[];
    topic_bridge?: Record<string, unknown>;
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

const SYSTEM_PROMPT = `あなたは競馬データメディア「UMA-FREE」の編集ライターだ。
与えられたJSONデータをもとに、Markdown形式の記事を執筆する。

【記事の役割】
- 検索から来た読者には「この条件で何を重く見るべきか」をすぐ掴ませる。
- 予想ページを繰り返し見る読者には、出馬表を見る前の判断メモとして使える内容にする。
- 重賞記事では、情報過多で迷っている読者に「枠順・脚質・斤量・人気のどこから確認するか」を示す。
- 平場向けの記事では、全頭を深く見られない読者に「買うレース」と「見送るレース」を分ける初期判断を渡す。
- ニュース起点の記事では、外部ニュースの焼き直しではなく「発表・話題を受けて、UMA-FREEで何を確認すべきか」を整理する。
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
  数値提示型：「8枠26.8%と1枠7.0%の格差」
  問題提起型：「なぜ内枠人気馬が崩れるのか」
  行動提示型：「枠順確定後に最初に確認すること」
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
- titleは数字だけで目を引かせない。検索ユーザーがクリック前に判断できるよう、「見方」「違い」「買い時」「見送り条件」「軸候補」「相手候補」など、記事で解決する行動を1つ入れる。
- 馬体重、馬場状態、控除率、騎手の得意コースなど一般クエリ寄りのテーマでは、titleの前半に読者の検索語に近い言葉を置き、後半に数字やデータの強みを置く。
- descriptionは「この記事を読むと何ができるか」を1文で閉じる。検索語の羅列、未完文、同じ語尾の連発、「確認できます」の連続は禁止。
- PC検索ではtitleの前半だけで比較されるため、「データ分析」「徹底解説」だけで終わらせず、買い時・疑う条件・当日の確認順序のいずれかを明示する。

【データの正確性（最重要）】
- 記事に使ってよい数値は、reference_data の key_metrics、course_stats、predictions相当の配列、または race_name / race_date / venue / total_horses / period / condition / sample_size などの明示フィールドに含まれる値だけ。
- 自分で勝率、回収率、母数、枠順別成績、斤量別成績、脚質別成績、AI偏差値を補完・推測・生成してはならない。
- データテーブルを作る場合は、入力JSONに存在する列名と値を使う。入力にない列を足さない。入力にない行を増やさない。
- 入力に枠順別・脚質別・斤量別の実数がない場合、そのテーブルは作らない。「未取得」「枠順確定後に確認」など、分かる範囲の定性的な説明に留める。
- reference_data.course_stats が空で key_metrics も空の場合は、レース名・開催日・会場・条件など、入力にある事実だけを小さな確認表にする。
- 数値の見栄えを良くするための丸め、線形補完、平均値の作成は禁止。必要な計算は、入力にすでに計算済みの値がある場合だけ使う。
- 「過去3年」などの期間表現は reference_data.period に従う。period がない場合は期間を断定しない。
- tavily_results、research_sources、external_research、web_research などの外部リサーチ情報が入力に含まれる場合、それは制度・開催情報・公式発表・注目点の補足にだけ使う。勝率、複勝率、回収率、騎乗回数、AI偏差値、枠順別成績、脚質別成績、斤量別成績の根拠には使わない。
- 外部リサーチ由来の話題を使う場合も、本文内に外部リンクは置かない。出典管理はシステム側のresearch_sourcesで行う前提とし、本文はUMA-FREE内の導線だけにする。
- research_sources の allowed_claims は「外部文脈として触れてよい話題」だけであり、記事の主役にしない。本文では「公式発表では〜」のような外部依存の言い回しを乱用せず、UMA-FREEのデータ確認順序を補助する範囲に留める。
- research_sources に含まれない外部情報やURLを新たに足してはいけない。
- theme_cluster が "news_context" または "race_update" の場合、reference_data.key_metrics はニュース本文の要約ではなく「確認済みの事実テーブル」として扱う。表にない日付・頭数・発表内容を勝手に補完しない。
- ニュース記事では、外部ソースの文章を言い換えて長く展開しない。外部事実は短く置き、その後に「出馬表で確認する順番」「馬場・枠順・脚質の見方」「/races/today への導線」へ移る。
- reference_data.search_intent_label がある場合、その検索意図を記事の中心に置く。たとえば「枠順」なら枠順確定後にどこを見るか、「出走馬」なら出走馬一覧から脚質・騎手・馬場をどう確認するかを主題にする。
- reference_data.topic_bridge がある場合、複数ニュースの話題をそのまま並べず、topic_bridge.primary_angle と merge_policy に沿って「外部ニュースの話題」→「UMA-FREE内部データで確認する順番」へ接続する。
- reference_data.predictions、course_stats、horse_number_advantages、ai_analysis_text、matched_race がある場合、それらはUMA-FREEが収集した内部データとして扱う。追い切り、前走後コメント、SNS話題、騎手ニュースなどの定性的な材料は、これらの数値や出馬表確認と結び付けて書く。
- 外部ニュース由来の追い切り評価や陣営コメントだけで評価を断定しない。AI偏差値、コース統計、馬番傾向がある場合は「評価を上げる材料」「確認を残す材料」「人気なら慎重に見る条件」に分ける。
- reference_data.days_to_race がある場合、開催までの日数に合わせて書く。開催前なら「直前に確認する順番」、開催後なら「次に同条件を見る時の確認材料」に寄せる。

【フォーマット要件】
- タイトル：厳格に30文字以上、50文字以内。
  - 構成: 「【競馬場+コース】＋ [狙い方の核心] ｜ [データ種別]」
  - 例: 「【京都芝1400m】3枠を軸にしやすい理由｜過去3年データ」
  - NG例: 「京都芝1400mは3枠複勝率35.2%で7枠勝率12.3%」（数字の羅列だけで読者の判断に繋がらない）
- ディスクリプション：120〜160文字。「この記事を読むと何ができるか」を明示。
- 見出し（H2・H3）：数字を含む見出しを最低1つ入れる。ただし全見出しを「3つの〜」に寄せない。同じ語尾の見出しを繰り返さない。
- 枠順別のデータ等は見やすくするため、【必ず1つ以上のMarkdown形式のデータテーブル】（| で区切る表）にすること。リスト代用は不可。ただし表の数値は入力JSONに存在する値だけを使う。
- 数値を使う場合は期間・条件・母数を必ず明記する。
- 本文3,400〜4,200字を目安にし、最低3,000字は必ず超える。ただし水増し禁止。短くなりそうな場合は、入力データから読み取れる「扱い方」「疑う条件」「当日の確認順序」「サンプル数が少ない場合の注意点」「検索読者が次に調べる観点」を具体化して厚みを出す。
- 生成後に本文量を自分で確認し、3,000字未満になりそうなら、架空の数値や外部情報を足さず、「出馬表で見る順番」「人気馬を疑う条件」「買い足す前の確認順」「評価を下げる条件」「ニュース後に確認する材料」のうち不足している観点を追加する。
- 本文中のCTAは /races/today または reference_data.race_url のみ。存在確認できないURLや仮のURLは書かない。

【記事の締め方 ― 確認ポイントセクション必須】
記事の最後のセクションは、theme_clusterに応じて以下の見出しで締める。
- "news_context": ## このニュースの確認ポイント
- "race_update" または "grade_race_preview": ## このレースの買い目ポイント
- それ以外: ## このコースの買い目ポイント
内容: 「買い」「抑え」「見送り」「条件付き」のような自然なラベルで、読者がすぐ使える判断基準を3〜5個提示。
例:
  - 買い: 軸候補は3枠。複勝率35.2%で安定している。
  - 抑え: 6枠の先行馬は回収率49%で相手に残す価値がある。
  - 見送り: 8枠は複勝率17.3%で、人気なら評価を下げる。
  - 条件付き: 2枠は内で脚をためられる先行馬だけ拾う。
ニュース記事では、数値がない項目に数字を付け足さず、「確認」「抑え」「見送り」「条件付き」の判断ラベルで整理する。
その後、以下の1文で記事を閉じる:
「最新の出馬表とAI予想は [今日のAI予想・出馬表](/races/today) で無料公開中。」

【禁止事項】
- 「まとめ」「総論」「おわりに」の見出しは禁止。代わりに「買い目ポイント」で締める。
- 以下の表現が含まれる場合、書き直せ:
  ・「〜と思っていませんか？」「この記事をお読みいただければ〜」
  ・「結論から言うと」「興味深いことに」「総じて〜」「〜に注目です」
  ・「絶対」「絶対的」「確実」「必勝」「完全攻略」「最強」「圧倒的」「狙い撃つ」「買うな」「消去対象」「いかがでしたか？」「ぜひ参考にしてください」
- ✅ や ❌ などの装飾記号は使わない。競馬の印（◎○▲△）は重賞プレビューの予想データに限って使用可。
- 【関連記事リンクの禁止】関連記事はシステム側が自動で表示するため、記事本文には「関連記事」セクションや「[関連記事：ダミー]」を含めない。存在確認できないスラッグへのリンクを生成すると404エラーになる。

【テーマクラスター別の追加指示】
入力データのtheme_clusterの値に応じて書き方を微調整する。
・"asset"/"waku_data": 枠順データの記事。枠番ごとの勝率テーブルを提示し、「買い」と「評価を下げる」枠を明確にする。
・"seasonal": 開催シーズン中の時事性を強調する枠順・傾向記事。
・"jockey_data": 騎手のコース成績記事。「勝率は高いが回収率は低い」等の人気とのズレを掘り下げる。
・"popularity_data": 配当傾向と上位人気の信頼度。「堅いコースか荒れるコースか」を明確にする。
・"running_style_data": コース形態と脚質の有利不利。直線距離や坂の有無を根拠にする。
・"grade_race_preview": 重賞レースのプレビュー記事。以下のルールに従う:
  - タイトル構成: 「[レース名][年] AI予想｜[確認すべきデータの核心]」（30〜50文字）
  - G1・G2は新規URLを乱立させず、同じ記事を「1週間前の展望」「枠順確定後」「前日更新」「当日朝更新」の4段階で育てる前提で書く。
  - frontmatterには update_stage を入れる。値は one_week_before / draw_confirmed / eve_update / race_morning のいずれか。
  - 追記更新を想定し、古い判断を消すのではなく「どの条件なら評価を上げるか」「どの条件なら見送るか」を更新後も読み返せる形にする。
  - 導入: レースの基本情報（開催場・コース・距離）を1〜2文で簡潔に。
  - コース傾向セクション必須: reference_data のデータから傾向をMarkdownテーブルで提示。
  - 予測データがある場合: 偏差値上位の馬を印（◎○▲△）付きで分析。
  - 予測データがない場合: コース傾向と過去データに絞って記述。「最新のAI偏差値・AI予想印は枠順確定後に出馬表ページで無料公開されます」と一文添え、reference_data.race_url のリンクを配置。
  - 読者は直前の不安解消を求めている。人気馬を煽るのではなく、疑う条件・買い足す条件・見送る条件を分けて書く。
  - 重賞記事で禁止する表現パターン：
    「〜騎手が乗るなら信頼できる」（主観）
    「〜の仕上がりは抜群」（根拠なし）
    「過去の実績から〜は鉄板」（確実性の断定）
  代わりに使う表現：
    「〇〇コースでの複勝率が〇〇%なので、
     同条件なら評価を上げる材料になる」
    「前走から条件が変わる点として〜がある」
・"news_context": 競馬ニュース起点の記事。以下のルールに従う:
  - タイトル構成: 「[ニュース内の主要語]｜出馬表で見る確認ポイント[数字]」（30〜50文字）
  - ニュースの全文要約は禁止。reference_data.key_metrics と research_sources.allowed_claims で確認できる事実だけを短く扱う。
  - 記事の主役は「その話題を受けて、出馬表・馬場・枠順・脚質・AI予想のどこを見るか」に置く。
  - reference_data.topic_bridge や内部データがある場合、複数ソースの話題を1つの確認順に束ね、外部ニュースの羅列にしない。
  - 外部ソース名やURLを本文内に並べない。必要な事実は「確認されている材料」として扱う。
  - 最後の見出しは「## このニュースの確認ポイント」にする。
・"race_update": レース関連ニュースから既存の重賞・日別レース導線へつなぐ記事。以下のルールに従う:
  - タイトル構成: 「[レース名][年]｜ニュース後に見る確認ポイント[数字]」（30〜50文字）
  - 枠順確定、出走予定、馬場、追い切り、前走後評価、陣営コメント、騎手変更、話題馬など、レース前に検索される語を自然に含める。
  - reference_data.predictions、course_stats、horse_number_advantages がある場合、ニュースの話題と内部データを別々に扱わず、直前に確認する順序として接続する。
  - 最新情報の断定より、/races/today で当日確認する順番を優先する。
  - 最後の見出しは「## このレースの買い目ポイント」にする。

【カテゴリの決定ルール】
theme_clusterの値に応じてcategoryを以下のように決定する。
  - "asset" -> "コース分析"
  - "seasonal" -> "コース分析"
  - "waku_data" -> "コース分析"
  - "jockey_data" -> "騎手分析"
  - "popularity_data" -> "馬券・統計"
  - "running_style_data" -> "コース分析"
  - "grade_race_preview" -> "重賞攻略"
  - "news_context" -> "競馬ニュース"
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
draft: true
---

（本文）
`;

function isRetryableGeminiError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return /429|quota|rate limit|resource exhausted|too many requests/i.test(message);
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
- ユーザーの検索意図（枠順、出走馬、馬場、追い切りなど）を徹底分析し、出馬表やAI予想で確認すべき順序へ置き換える。
- 検索エンジンで上位表示されるため、ターゲットキーワードに基づき、検索需要が高い関連キーワード（ロングテールキーワード）を抽出し、それらを自然に配置するための構成案を作成する。
- 本文を厚くし、情報価値（一次情報としての独自データ分析）を高めるための安全な追加観点を提案する。
- ただし、入力JSONにない数値、馬名、成績、外部事実は絶対に作らない。
- 煽り、過剰な断定、購入を強く促す表現は避ける。

【出力JSON】
{
  "primary_search_intent": "検索ユーザーがこの記事で解決したい具体的な悩みや疑問を1文で書く",
  "title_angles": ["30〜50文字のタイトルで、ターゲットキーワードを含みつつ、クリックされやすい自然な切り口を3件"],
  "section_plan": ["検索流入を最大化するためのH2見出し候補を5〜7件。最低2件は具体的な数値や条件を含める"],
  "expansion_angles": ["3,000字以上にするために深掘りできる、コース形態や当日の馬場状態に応じた安全な分析・確認の観点を5件"],
  "long_tail_terms": ["本文や見出しに自然に含めたい検索語（例：『馬場状態』『脚質有利』『オッズ妙味』『枠番有利』等）を5〜10件"],
  "fact_guardrails": ["捏造を避け、正確なデータのみを提示するための注意点を3〜5件"],
  "internal_link_flow": ["記事の末尾から [今日のAI予想・出馬表](/races/today) へ読者を自然に誘導するための観点を2〜3件"]
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

      reserveGeminiRequest({
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
  const modelName = 'gemma-4-31b-it'; // クォータ制限が緩いモデルを固定で使用
  const SYSTEM_PROMPT = `あなたは競馬データメディア「UMA-FREE」の編集ライターだ。
与えられた現在の記事ドラフトとWriteOrderに基づき、記事の文字数を増やしつつ品質と専門性を高めるために、新たなH2セクション（見出しと詳細な解説本文）を1〜2件追加執筆する。

【執筆のルール】
1. 絶対に架空の数値、成績、馬名などを捏造しない。WriteOrder.reference_dataに明記されている実データ（勝率、複勝率、回収率など）のみを数値根拠として使用すること。データがない場合は、定性的な分析（コース形状の特徴、スタートから最初のコーナーまでの距離、急坂の有無、当日の馬場状態に応じた確認手順など）を詳しく述べる。
2. 読者が「出馬表で何を確認すべきか」「どのような条件なら評価を上げる/下げるか」という実務的なチェック手順にフォーカスして執筆する。
3. 煽り表現（「最強」「絶対」「必勝」など）や、AI特有の手癖表現（「いかがでしたか」「今回は〜について解説します」「興味深いことに」など）は一切禁止。
4. Markdown形式の適切なH2（##）とH3（###）で記述する。
5. 出力は、追加するセクションのMarkdownテキストのみとすること。前置きや説明は不要。`;

  const prompt = `以下の現在の記事ドラフトとWriteOrder情報に基づき、記事を補強する新しい詳細なH2セクションを執筆してください。
追加するセクションは、現在のドラフトの「締めセクション（## このコースの買い目ポイント / ## このレースの買い目ポイント / ## このニュースの確認ポイント）」の直前に安全に挿入できるような構成にしてください。

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

    reserveGeminiRequest({
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

/**
 * ライターエンジンを実行し、指定されたWriteOrderに基づいて記事ドラフトを生成する
 */
export async function generateDraft(order: WriteOrder): Promise<{ success: boolean; filePath?: string; error?: string; retryable?: boolean }> {
  let retryableFailure = false;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { success: false, error: "GEMINI_API_KEY is not set." };
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelTiers = getGeminiModelTiers('GEMINI_WRITER_MODEL_TIERS');
    console.log(`[Writer] LLM strategy: ${getArticleLlmStrategySummary()}`);

    const strategyBrief = await buildArticleStrategyBrief(order, genAI);
    const strategySection = strategyBrief
      ? `\n\n【Gemma SEO/構成ブリーフ】\n${JSON.stringify(strategyBrief, null, 2)}`
      : '';
    const prompt = `以下の入力データ（WriteOrder）に基づいて記事を生成する。${strategySection}\n\n【WriteOrder】\n${JSON.stringify(order, null, 2)}`;
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

        try {
            reserveGeminiRequest({
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
                continue;
            }
            console.error(`[Writer Warning] ${currentModelName} failed: ${e.message}`);
            lastErrorMessage = e.message || String(e);
            if (isRetryableGeminiError(e)) {
                retryableFailure = true;
            }
            if (i === modelTiers.length - 1) {
                throw new Error(`すべての生成モデルでの試行が失敗しました。${lastErrorMessage}`);
            }
        }
    }

    let text = result?.response.text();

    if (!text) {
      throw new Error("生成されたテキストが空でした。");
    }

    // Markdownのコードブロックマーカー(```markdown)がAIの癖で出力された場合は除去する
    text = text.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
    console.log(`[Writer] Draft length: ${text.replace(/\s/g, '').length} chars`);

    // Gemmaによる動的拡張
    const minChars = parsePositiveInt(process.env.ARTICLE_MIN_BODY_CHARS, 3000);
    const plainLen = text.replace(/\s/g, '').length;

    if (plainLen < minChars) {
      console.log(`[Writer] Draft length (${plainLen} chars) is below target (${minChars} chars). Expanding dynamically with Gemma...`);
      try {
        const expandedText = await expandDraftWithGemma(order, text, minChars - plainLen, genAI);
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
    fs.writeFileSync(filePath, text, 'utf-8');

    console.log(`[Writer] Draft successfully saved to: ${filePath}`);

    return { success: true, filePath };

  } catch (error: any) {
    console.error(`[Writer Error] ${error.message}`);
    return {
      success: false,
      error: error.message,
      retryable: retryableFailure || error instanceof GeminiQuotaExceededError || isRetryableGeminiError(error),
    };
  }
}

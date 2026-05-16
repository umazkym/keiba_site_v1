import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGeminiModelTiers } from './model_tiers';
import { GeminiQuotaExceededError, reserveGeminiRequest } from './gemini_quota';

// APIキーは環境変数から取得

export type WriteOrder = {
  target_keyword: string;
  theme_cluster: string;
  reference_data: {
    period: string;
    condition: string;
    sample_size: number;
    key_metrics: Record<string, string | number>[];
    source: string;
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
- 煽り、断定しすぎ、機械的なSEO文は避ける。数字を根拠に、競馬ファンが自然に読める実務的な文章にする。

【書き方の原則】
- 1文目から核心データを提示し、読者が取るべき確認順序を示す。挨拶・趣旨説明・問いかけは書かない。
- 数字を出したら、必ず「馬券検討ではどう扱うか」まで落とし込む。
- 文末は原則として曖昧に逃げない。ただし母数が少ない、差が小さい、回収率だけが突出している場合は「軸にはしにくい」「相手候補まで」といった抑制を入れる。
- 前回と同じ見出し構成・同じ文の流れにしない。坂、直線、コーナー、スタート位置、開催時期など、条件固有の要素を1つ以上絡める。
- 「当たる」「儲かる」と読ませる文章ではなく、「買い方の優先順位が整理できる」文章にする。
- 読者を急かす文ではなく、直前に迷った時のチェックリストとして残る文章にする。

【フォーマット要件】
- タイトル：厳格に30文字以上、40文字以内。
  - 構成: 「【競馬場+コース】＋ [狙い方の核心] ｜ [データ種別]」
  - 例: 「【京都芝1400m】3枠を軸にしやすい理由｜過去3年データ」
  - NG例: 「京都芝1400mは3枠複勝率35.2%で7枠勝率12.3%」（数字の羅列だけで読者の判断に繋がらない）
- ディスクリプション：120〜140文字。「この記事を読むと何ができるか」を明示。
- 見出し（H2・H3）：最後の「このコースの買い目ポイント」を除き、数字と実用的な結論を両方含める。
- 枠順別のデータ等は見やすくするため、【必ず1つ以上のMarkdown形式のデータテーブル】（| で区切る表）にすること。リスト代用は不可。
- 数値を使う場合は期間・条件・母数を必ず明記する。
- 本文1,500字以上。ただし水増し禁止。
- 本文中のCTAは /races/today または reference_data.race_url のみ。存在確認できないURLや仮のURLは書かない。

【記事の締め方 ― 「買い目のポイント」セクション必須】
記事の最後のセクションは必ず以下の形式で締めろ。
見出し: ## このコースの買い目ポイント
内容: 「買い」「抑え」「見送り」「条件付き」のような自然なラベルで、読者がすぐ使える判断基準を3〜5個提示。
例:
  - 買い: 軸候補は3枠。複勝率35.2%で安定している。
  - 抑え: 6枠の先行馬は回収率49%で相手に残す価値がある。
  - 見送り: 8枠は複勝率17.3%で、人気なら評価を下げる。
  - 条件付き: 2枠は内で脚をためられる先行馬だけ拾う。
その後、以下の1文で記事を閉じろ:
「このコースの最新レースは [今日のAI予想・出馬表](/races/today) で無料公開中。」

【絶対禁止事項】
- 「まとめ」「総論」「おわりに」の見出しは禁止。代わりに「買い目ポイント」で締めろ。
- 以下の表現が含まれる場合、書き直せ:
  ・「〜と思っていませんか？」「この記事をお読みいただければ〜」
  ・「結論から言うと」「興味深いことに」「総じて〜」「〜に注目です」
  ・「絶対」「絶対的」「確実」「必勝」「完全攻略」「最強」「圧倒的」「狙い撃つ」「買うな」「消去対象」「いかがでしたか？」「ぜひ参考にしてください」
- ✅ や ❌ などの装飾記号は使わない。競馬の印（◎○▲△）は重賞プレビューの予想データに限って使用可。
- 【関連記事リンクを本文中に書くな】。関連記事はシステム側が自動で表示するため、記事本文には「関連記事」セクションや「[関連記事：ダミー]」を一切含めるな。存在しないスラッグへのリンクを生成すると404エラーになる。

【テーマクラスター別の追加指示】
入力データのtheme_clusterの値に応じて書き方を微調整せよ。
・"asset"/"waku_data": 枠順データの記事。枠番ごとの勝率テーブルを提示し、「買い」と「消し」の枠を明確にせよ。
・"seasonal": 開催シーズン中の時事性を強調する枠順・傾向記事。
・"jockey_data": 騎手のコース成績記事。「勝率は高いが回収率は低い」等の期待値の逆転を掘り下げろ。
・"popularity_data": 配当傾向と上位人気の信頼度。「堅いコースか荒れるコースか」を明確にせよ。
・"running_style_data": コース形態と脚質の有利不利。直線距離や坂の有無を根拠にせよ。
・"grade_race_preview": 重賞レースのプレビュー記事。以下のルールに従え:
  - タイトル構成: 「[レース名][年] AI予想｜[確認すべきデータの核心]」（30〜40文字）
  - 導入: レースの基本情報（開催場・コース・距離）を1〜2文で簡潔に。
  - コース傾向セクション必須: reference_data のデータから傾向をMarkdownテーブルで提示。
  - 予測データがある場合: 偏差値上位の馬を印（◎○▲△）付きで分析。
  - 予測データがない場合: コース傾向と過去データに絞って記述。「最新のAI偏差値・AI予想印は枠順確定後に出馬表ページで無料公開されます」と一文添え、reference_data.race_url のリンクを配置。
  - 読者は直前の不安解消を求めている。人気馬を煽るのではなく、疑う条件・買い足す条件・見送る条件を分けて書く。

【カテゴリの決定ルール】
theme_clusterの値に応じてcategoryを以下のように決定せよ。
  - "asset" -> "コース分析"
  - "seasonal" -> "コース分析"
  - "waku_data" -> "コース分析"
  - "jockey_data" -> "騎手分析"
  - "popularity_data" -> "馬券・統計"
  - "running_style_data" -> "コース分析"
  - "grade_race_preview" -> "重賞攻略"

【出力形式】
説明文・謝辞・前置き一切不要。以下のFrontmatter付きMarkdownのみを出力せよ。

---
title: ""
description: ""
keywords: []
target_keyword: ""
theme_cluster: ""
category: ""
draft: true
---

（本文）
`;

function isRetryableGeminiError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return /429|quota|rate limit|resource exhausted|too many requests/i.test(message);
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

    const prompt = `以下の入力データ（WriteOrder）に基づいて記事を生成せよ。\n\n${JSON.stringify(order, null, 2)}`;
    console.log(`[Writer] Generating draft for keyword: ${order.target_keyword}...`);

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
            break; // 成功したら抜ける
        } catch (e: any) {
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

    const filePath = path.join(queueDir, `${timestamp}.md`);
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

import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

const SYSTEM_PROMPT = `あなたはデータ駆動型競馬メディア「UMA-FREE」の専属ライターだ。
与えられたJSONデータをもとに、Markdown形式の記事を執筆する。

【書き方の原則】
- 1文目から記事の核心データを提示し、結論を断言して始める。挨拶・趣旨説明・問いかけは一切書くな。
- 数字を出したら即座に「だからどう買うべきか」の判断に繋げろ。データの羅列だけで終わるな。
- 文末は断言で終わらせる。「〜でしょう」「〜かもしれません」は使うな。ただし、データが拮抗しているときは「強くは推せない」という判断を明示的に書け。
- 前回と同じ見出し構成・同じ文の流れにするな。コース固有の特徴（坂の有無、直線の長さ、コーナー角度など）を絡めて記事ごとに独自性を出せ。

【フォーマット要件】
- タイトル：厳格に30文字以上、40文字以内。
  - 構成: 「【競馬場+コース】＋ [狙い目/買い方の核心] ｜ [データの裏付け]」
  - 例: 「【京都芝1400m攻略】3枠軸の馬券が最強な理由｜枠順データ分析」
  - NG例: 「京都芝1400mは3枠複勝率35.2%が最強で7枠勝率12.3%が急所」（数字の羅列でクリック喚起力がない）
- ディスクリプション：120〜140文字。「この記事を読むと何ができるか」を明示。
- 見出し（H2・H3）：数字と実用的な結論を両方含める。
- 枠順別のデータ等は見やすくするため、【必ず1つ以上のMarkdown形式のデータテーブル】（| で区切る表）にすること。リスト代用は不可。
- 数値を使う場合は期間・条件・母数を必ず明記する。
- 本文1,500字以上。ただし水増し禁止。

【記事の締め方 ― 「買い目のポイント」セクション必須】
記事の最後のセクションは必ず以下の形式で締めろ。
見出し: ## このコースの買い目ポイント
内容: ✅ と ❌ を使った箇条書きで、読者がすぐ使える判断基準を3〜5個提示。
例:
  ✅ 軸にするなら3枠（複勝率35.2%で安定）
  ✅ 穴を狙うなら6枠の先行馬（回収率49%）
  ❌ 8枠は消し（複勝率17.3%で最低）
  ❌ 2枠・4枠の単勝は買うな（回収率0%）
その後、以下の1文で記事を閉じろ:
「このコースの最新レースは [今日のAI予想・出馬表](/races/today) で無料公開中。」

【絶対禁止事項】
- 「まとめ」「総論」「おわりに」の見出しは禁止。代わりに「買い目ポイント」で締めろ。
- 以下の表現が含まれる場合、書き直せ:
  ・「〜と思っていませんか？」「この記事をお読みいただければ〜」
  ・「結論から言うと」「興味深いことに」「総じて〜」「〜に注目です」
  ・「絶対」「確実」「必勝」「完全攻略」「いかがでしたか？」「ぜひ参考にしてください」
- 【関連記事リンクを本文中に書くな】。関連記事はシステム側が自動で表示するため、記事本文には「関連記事」セクションや「[関連記事：ダミー]」を一切含めるな。存在しないスラッグへのリンクを生成すると404エラーになる。

【テーマクラスター別の追加指示】
入力データのtheme_clusterの値に応じて書き方を微調整せよ。
・"asset"/"waku_data": 枠順データの記事。枠番ごとの勝率テーブルを提示し、「買い」と「消し」の枠を明確にせよ。
・"seasonal": 開催シーズン中の時事性を強調する枠順・傾向記事。
・"jockey_data": 騎手のコース成績記事。「勝率は高いが回収率は低い」等の期待値の逆転を掘り下げろ。
・"popularity_data": 配当傾向と上位人気の信頼度。「堅いコースか荒れるコースか」を明確にせよ。
・"running_style_data": コース形態と脚質の有利不利。直線距離や坂の有無を根拠にせよ。
・"grade_race_preview": 重賞レースのプレビュー記事。以下のルールに従え:
  - タイトル構成: 「[レース名][年] AI予想｜[最も注目すべきデータの核心]」（30〜40文字）
  - 導入: レースの基本情報（開催場・コース・距離）を1〜2文で簡潔に。
  - コース傾向セクション必須: reference_data のデータから傾向をMarkdownテーブルで提示。
  - 予測データがある場合: 偏差値上位の馬を印（◎○▲△）付きで分析。
  - 予測データがない場合: コース傾向と過去データに絞って記述。「最新のAI偏差値・AI予想印は枠順確定後に出馬表ページで無料公開されます」と一文添え、reference_data.race_url のリンクを配置。

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

/**
 * ライターエンジンを実行し、指定されたWriteOrderに基づいて記事ドラフトを生成する
 */
export async function generateDraft(order: WriteOrder): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { success: false, error: "GEMINI_API_KEY is not set." };
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelTiers = [
      'gemini-3-flash-preview',
      'gemini-3.1-flash-lite-preview',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite'
    ];

    const prompt = `以下の入力データ（WriteOrder）に基づいて記事を生成せよ。\n\n${JSON.stringify(order, null, 2)}`;
    console.log(`[Writer] Generating draft for keyword: ${order.target_keyword}...`);

    let result;
    let usedModel = '';
    
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
            result = await model.generateContent(prompt);
            usedModel = currentModelName;
            break; // 成功したら抜ける
        } catch (e: any) {
            console.error(`[Writer Warning] ${currentModelName} failed: ${e.message}`);
            if (i === modelTiers.length - 1) {
                throw new Error("すべての生成モデルでの試行が失敗しました。");
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
    return { success: false, error: error.message };
  }
}

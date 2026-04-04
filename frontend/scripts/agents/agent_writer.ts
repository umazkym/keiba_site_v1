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
};

const SYSTEM_PROMPT = `あなたはデータ駆動型競馬メディア「UMA-FREE」の専属ライターだ。
与えられたJSONデータをもとに、Markdown形式の記事を執筆する。

【書き方の原則】
- 1文目から記事の核心データを提示し、結論を断言して始める。挨拶・趣旨説明・問いかけは一切書くな。
- 数字を出したら即座に因果関係の説明に移れ。「◯回に1回」「驚くべきことに」などの換算・感想は挟むな。
- 文末は断言で終わらせる。「〜でしょう」「〜かもしれません」は使うな。ただし、データが拮抗しているときは「強くは推せない」という判断を明示的に書け。これは弱さではなく誠実さだ。
- 「まとめ」や「総論」の見出しは作るな。記事の最後は、直前のデータの事実の一文のみで唐突に終わらせる。「～が鍵となる」「～を実現する」「戦略に組み込む」「参考に」等の語尾や総論は一発不合格となるため絶対禁止。

【フォーマット要件】
- タイトル：厳格に30文字以上、36文字以内。構成は「[競馬場/条件] ＋ [最強数字] ＋ [読者が得るもの]」
- ディスクリプション：120〜140文字。読後に得る具体的な数値・視点を書く。
- 見出し（H2・H3）：必ず数字と結論を両方含める
- 枠順別のデータ等は見やすくするため、【必ず1つ以上のMarkdown形式のデータテーブル】（| で区切る表）にすること。リスト代用は不可。
- 本文中の段落間に「[関連記事：ダミー]」という文字列を【必ず2箇所以上】独立した行として記載すること。
- 数値を使う場合は期間・条件・母数を必ず明記する
- 本文1,500字以上。ただし水増し禁止。データが薄くて達成できない場合は記事を生成せず、理由を出力して終了せよ。

【絶対禁止ワード】
以下の表現が1文字でも含まれる場合、その段落または文を削除して書き直せ。
・導入テンプレート：「〜と思っていませんか？」「この記事をお読みいただければ〜」「オカルトや個人の感覚ではなく」「曖昧な勘に頼るのではなく」
・AI手癖：「結論から言うと」「興味深いことに」「総じて〜」「〜に注目です」「独自の分析スクリプトで解析し」「膨大なデータを徹底的に解析しました」「〜と言えるでしょう」
・誇張・締め定型：「絶対」「確実」「必勝」「完全攻略」「いかがでしたか？」「ぜひ参考にしてください」「〜を楽しみましょう」「〜の真実を物語っています」

【テーマクラスター別の追加指示】
入力データのtheme_clusterの値に応じて書き方を微調整せよ。
・"asset": 通年のストック記事。3年分のデータの蓄積的価値を重視し、統計的な網羅性を出す。
・"seasonal": 開催シーズン中の時事性を強調する。導入の1〜2文目で「今開催中の〇〇競馬場で」「今シーズンの〇〇開催では」のような直近の時事フックを入れ、データの即効性をアピールする。ただし誇張禁止のルールは同様に厳守。
・"grade_race_preview": 重賞レースのプレビュー記事。AI偏差値データを軸に注目馬を分析する。

【カテゴリの決定ルール】
theme_clusterの値に応じてcategoryを以下のように決定せよ。
・"asset" または "seasonal" → category: "枠順データ"
・"grade_race_preview" → category: "重賞プレビュー"

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

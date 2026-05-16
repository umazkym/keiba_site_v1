import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { checkSEO } from './seo_checker';
import { getGeminiModelTiers } from './model_tiers';
import { GeminiQuotaExceededError, reserveGeminiRequest } from './gemini_quota';

function applyReplacement(content: string, original: string, fixed: string): { success: boolean, result: string } {
  // \r\n と \n の差異を完全に吸収するため、全体を \n に統一してから完全一致置換を行う
  const normalizeContent = (s: string) => s.replace(/\r\n/g, '\n');
  const normalizeOriginal = (s: string) => s.replace(/\r\n/g, '\n').trim();
  const normalizedContent = normalizeContent(content);
  const normalizedOriginal = normalizeOriginal(original);
  
  if (!normalizedContent.includes(normalizedOriginal)) {
    console.warn(`[Editor Warning] 置換対象が見つかりません:\n"${original.substring(0, 50)}..."`);
    return { success: false, result: content };
  }

  // 正規化済みの文字列に対して、完全一致による置換を実行する（正規表現のサイレント失敗を防ぐ）
  const resultContent = normalizedContent.replace(normalizedOriginal, fixed);
  return { success: true, result: resultContent };
}

const EDITOR_SYSTEM_PROMPT = `あなたはUMA-FREEの編集長だ。ライターが生成したMarkdown記事を検閲し、以下の手順で指定されたJSONフォーマットのみを出力せよ。

【検閲の手順】
STEP 1：禁止ワードスキャン
記事全文から、導入テンプレート、AI手癖表現、誇張表現などの禁止ワードを抽出し、修正文言を作成する。
STEP 2：構造チェック
・1文目に核心データと、読者が最初に確認すべき材料が含まれているか
・見出しに数字と結論が含まれているか（最後の「このコースの買い目ポイント」は例外）
・「まとめ」や「総論」などの見出しが存在しないか
・記事末尾に「## このコースの買い目ポイント」があり、最後に「このコースの最新レースは [今日のAI予想・出馬表](/races/today) で無料公開中。」が自然に入っているか
・✅ や ❌ などの装飾記号、煽りの強い「最強」「圧倒的」「狙い撃つ」「買うな」「消去対象」が残っていないか
・重賞記事は、人気馬を煽るだけでなく「疑う条件」「買い足す条件」「見送る条件」が分かれているか
・平場向け記事は、短時間で複数レースを見る読者が使える初期判断になっているか
STEP 3：フォーマットとSEOのチェック
・タイトルの文字数（30〜40文字）と構成
・ディスクリプションの文字数（120〜140文字）
※もし「事前の機械チェック結果」でエラーが指摘されている場合は、必ずそれを満たすようにtitleとdescriptionを修正すること。
※関連記事プレースホルダーは要求しない。本文中に「関連記事」セクションや「[関連記事：...]」は追加しないこと。
※存在確認できないURL、仮URL、単独行の「(/course-xxx)」のような壊れたリンク片は必ず削除すること。
※本文を長くしすぎない。必要な修正だけ行い、表・数値・母数・期間は壊さないこと。

【JSON出力フォーマット】
以下のJSONスキーマに従って出力せよ。Markdownのコードブロックなどは含めず、純粋なJSON文字列のみを出力すること。
{
  "status": "APPROVED" | "REJECTED",
  "log": "検閲の所感やエラー理由の一言メモ",
  "fixed_frontmatter": {
    "title": "新しいタイトル",
    "description": "新しいディスクリプション"
  },
  "content_replacements": [
    {
      "original": "削除・置換対象の元の文字列（数十字程度）",
      "fixed": "修正後の文字列"
    }
  ]
}
※修正不要な要素（fixed_frontmatter や content_replacements）は空または省略してよい。

【極秘指示】
元の原稿に含まれているデータテーブル（| で構築された表）およびリスト要素に対する修正は確実な理由がない限り行わないこと。表自体を削除・破壊してはならない。`;

function isRetryableGeminiError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return /429|quota|rate limit|resource exhausted|too many requests/i.test(message);
}

export async function reviewDraft(filePath: string): Promise<{ status: 'APPROVED' | 'REJECTED'; log: string, newDraftPath?: string; retryable?: boolean }> {
  let retryableApiFailure = false;

  try {
    const revisedPath = filePath.replace('.md', '_revised.md');
    if (fs.existsSync(revisedPath)) {
      fs.unlinkSync(revisedPath);
      console.log(`[Editor] Cleaned up previous revised file: ${revisedPath}`);
    }

    let currentContent = fs.readFileSync(filePath, 'utf-8');
    let finalStatus: 'APPROVED' | 'REJECTED' = 'REJECTED';
    let newDraftPath: string | undefined = undefined;
    let allLogs = "";
    let lastApiErrorMessage = "";

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set.");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelTiers = getGeminiModelTiers('GEMINI_EDITOR_MODEL_TIERS');

    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`[Editor] Running AI evaluation (Attempt ${attempt})...`);
      const seoResult = checkSEO(currentContent);
      const mechanicalLog = seoResult.passed
        ? "機械チェック（文字数・NGワード等）：エラーなし"
        : `機械チェックエラー（以下の違反を必ず修正すること）:\n - ${seoResult.errors.join('\n - ')}`;

      allLogs += `\n[Attempt ${attempt} Mechanical Check]\n${mechanicalLog}\n`;

      const prompt = `以下のドラフト記事（Markdown）を検閲せよ。\n\n【事前の機械チェック結果】\n${mechanicalLog}\n\n\`\`\`markdown\n${currentContent}\n\`\`\``;

      let response: any = null;
      let generateFailed = true;

      for (let i = 0; i < modelTiers.length; i++) {
        const currentModelName = modelTiers[i];
        console.log(`[Editor] Attempt ${attempt} - Trying model: ${currentModelName}`);
        
        const model = genAI.getGenerativeModel({
          model: currentModelName,
          systemInstruction: EDITOR_SYSTEM_PROMPT,
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        });

        try {
          const parsedForQuota = matter(currentContent);
          reserveGeminiRequest({
            scope: 'article',
            model: currentModelName,
            purpose: `editor-attempt-${attempt}`,
            target: parsedForQuota.data.target_keyword || parsedForQuota.data.title,
          });
          response = await model.generateContent(prompt);
          generateFailed = false;
          break; // 成功したら次へ
        } catch (e: any) {
          if (e instanceof GeminiQuotaExceededError) {
            console.error(`[Editor Warning] ${currentModelName} quota guard: ${e.message}`);
            if (e.kind === 'total' || i === modelTiers.length - 1) {
              throw e;
            }
            continue;
          }
          console.error(`[Editor Warning] ${currentModelName} failed: ${e.message}`);
          allLogs += `\n[Editor Warning] ${currentModelName} failed: ${e.message}\n`;
          lastApiErrorMessage = e.message || String(e);
          if (isRetryableGeminiError(e)) {
            retryableApiFailure = true;
          }
        }
      }

      if (generateFailed || !response) {
         allLogs += `\n[Editor Fatal] すべてのモデルでAPIリクエストが失敗しました。\n`;
         if (retryableApiFailure) {
           throw new Error(`Gemini APIの一時的な制限によりレビューを完了できませんでした。${lastApiErrorMessage}`);
         }
         break;
      }

      const editorText = response.response.text() || '';
      allLogs += `\n[Attempt ${attempt} AI Editor JSON Response]\n${editorText}\n`;

      let parsedJson: any = null;
      try {
        const jsonStr = editorText.replace(/^[^{]*/, '').replace(/[^}]*$/, '').trim();
        parsedJson = JSON.parse(jsonStr);
      } catch (e: any) {
        allLogs += `\n[Editor Fatal] JSONパースフェイル: ${e.message}\n`;
        break; // JSON形式で返してこない場合は即座にアボート
      }

      // JSONを適用して content を更新
      const parsedMatter = matter(currentContent);
      if (parsedJson.fixed_frontmatter) {
        if (parsedJson.fixed_frontmatter.title) parsedMatter.data.title = parsedJson.fixed_frontmatter.title;
        if (parsedJson.fixed_frontmatter.description) parsedMatter.data.description = parsedJson.fixed_frontmatter.description;
      }

      let tmpContent = parsedMatter.content;
      let replacementFailed = false;

      if (parsedJson.content_replacements && Array.isArray(parsedJson.content_replacements)) {
        for (const rep of parsedJson.content_replacements) {
          if (rep.original && rep.fixed !== undefined) {
            // 暴走したAIが差分パッチを利用して表を壊そうとした場合はプログラム側で防御
            if (rep.original.includes('| ---') || rep.original.includes('| :---') || rep.original.includes('--- |')) {
              allLogs += `\n[Editor Protective] AIが表(\`| --- \`)を置換・削除しようとしたため、プログラムが強制ブロックしました。\n`;
              continue;
            }
            const res = applyReplacement(tmpContent, rep.original, rep.fixed);
            if (!res.success) {
              replacementFailed = true;
              allLogs += `\n[Editor Warning] 置換対象が見つかりません: ${rep.original.slice(0, 30)}...\n`;
            } else {
              tmpContent = res.result;
            }
          }
        }
      }

      // FrontmatterとBodyを再結合
      currentContent = matter.stringify(tmpContent, parsedMatter.data);

      // パッチ後の内容でSEO再チェック
      const postPatchSeo = checkSEO(currentContent);
      if (postPatchSeo.passed && parsedJson.status === 'APPROVED' && !replacementFailed) {
        finalStatus = 'APPROVED';
        allLogs += `\n[Attempt ${attempt}] SEO Passed. Fully APPROVED.\n`;
        break; // 完全合格
      } else {
        allLogs += `\n[Attempt ${attempt}] AI status was ${parsedJson.status}. Post-patch SEO passed: ${postPatchSeo.passed}. Replacement Failed: ${replacementFailed}\n`;
      }
    }

    if (finalStatus === 'REJECTED') {
      newDraftPath = filePath.replace('.md', '_revised.md');
      fs.writeFileSync(newDraftPath, currentContent, 'utf-8');
      console.log(`[Editor] Draft was REJECTED after retries. Revised draft saved to: ${newDraftPath}`);
    } else if (finalStatus === 'APPROVED') {
      const approvedDir = path.join(__dirname, '..', '..', 'agents', 'queue', 'approved');
      fs.mkdirSync(approvedDir, { recursive: true });
      newDraftPath = path.join(approvedDir, path.basename(filePath));

      fs.writeFileSync(newDraftPath, currentContent, 'utf-8');
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      console.log(`[Editor] Draft APPROVED. Saved to: ${newDraftPath}`);

      // posted_history.json に追記
      try {
        const historyPath = path.join(__dirname, '..', '..', '..', 'data', 'posted_history.json');
        const dataDir = path.dirname(historyPath);
        if (!fs.existsSync(dataDir)) { fs.mkdirSync(dataDir, { recursive: true }); }
        const history = fs.existsSync(historyPath) ? JSON.parse(fs.readFileSync(historyPath, 'utf-8')) : [];
        const parsed = matter(currentContent);
        history.push({
          id: path.basename(filePath, '.md'),
          title: parsed.data.title || '',
          target_keyword: parsed.data.target_keyword || '',
          theme_cluster: parsed.data.theme_cluster || '',
          keywords: parsed.data.keywords || [],
          posted_at: new Date().toISOString(),
          draft: true,
          // 施策G: 収益ポテンシャルスコア（Phase 4/6で自動入力）
          estimated_monthly_searches: null,
          actual_pv_30d: null,
          ad_revenue_30d: null,
          rewrite_score: null,
        });
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');
        console.log(`[Editor] History updated: ${historyPath}`);
      } catch (err: any) {
        console.error(`[Editor] Failed to update history: ${err.message}`);
      }
    }

    return { status: finalStatus, log: allLogs, newDraftPath };

  } catch (error: any) {
    console.error(`[Editor Error] ${error.message}`);
    return {
      status: 'REJECTED',
      log: `エラーにより検証失敗: ${error.message}`,
      retryable: error instanceof GeminiQuotaExceededError || isRetryableGeminiError(error),
    };
  }
}

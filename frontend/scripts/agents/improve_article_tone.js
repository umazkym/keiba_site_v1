// frontend/scripts/agents/improve_article_tone.js
// 用途：記事トーンの一括改善（ワンショット実行）
// 実行：node scripts/agents/improve_article_tone.js --apply

const fs = require('fs');
const path = require('path');

const ARTICLES_DIR = path.join(__dirname, '..', '..', 'content', 'articles');

// ─── 改善ルール定義 ───────────────────────────────────────────────

const TONE_RULES = [
  // 【1】購入推奨ニュアンスを中立的な表現に
  { from: /資金を(?:集中)?投下/g,          to: '買い目を厚くする' },
  { from: /厚め(?:の|に)(?:勝負|投資)/g,  to: '評価を上げた買い方' },
  { from: /買い目に厚みを持たせ/g,         to: '買い目に入れ' },
  { from: /馬券購入資金/g,                 to: '買い目' },
  { from: /購入候補/g,                     to: '検討候補' },
  { from: /購入額/g,                       to: '買い目の金額' },
  { from: /購入することが/g,              to: '検討することが' },
  { from: /積極的に購入/g,                 to: '積極的に評価' },

  // 【2】過剰な確信表現の緩和
  { from: /間違いなく/g,                   to: 'おそらく' },
  { from: /確実に(?:上位|好走|勝)/g,       to: 'が期待できる' },
  { from: /鉄板(?:の軸|候補)/g,           to: '有力な軸候補' },
  { from: /磐石/g,                          to: '安定した' },
  { from: /不動の/g,                        to: '有力な' },
  { from: /絶対的/g,                        to: 'はっきりした' },
  { from: /絶対(?!的)/g,                    to: '条件が合えば' },
  
  // 【3】文末定型化の解消（連続する同パターンの変形）
  { from: /となっている。\n(.*?)となっている。/g,
    to: (m, mid) => `となっている。\n${mid}を示す。` },
  { from: /必要となる。\n(.*?)必要となる。/g,
    to: (m, mid) => `必要になる。\n${mid}求められる。` },

  // 【4】「かなり」の過剰使用を修正
  // （同一段落に3回以上あれば最初の1つだけ残し後は言い換え）
  // ※段落単位の処理は後述の関数で行う

  // 【5】AI生成特有の冗長フレーズ
  { from: /このように、?データ(?:から|が|は)/g,  to: 'このデータは' },
  { from: /以上のことから、?/g,                   to: '' },
  { from: /これらの(?:データ|数値|結果|事実)(?:から|を見ると)、?/g, to: '' },
  { from: /前述の(?:通り|ように)、?/g,            to: '' },
  { from: /(?:まず|次に|最後に)(?:、| )(?:確認|整理|説明)/g,
    to: (m) => m.replace(/まず|次に|最後に/, '').trim() },
  
  // 【6】「重要」の言い換え
  { from: /重要なポイントとなる/g,        to: '判断の基準になる' },
  { from: /重要な要素となる/g,             to: 'レース結果に影響する' },
  { from: /非常に重要/g,                   to: '見落とせない' },
  { from: /最も重要な/g,                   to: '特に確認したい' },
  
  // 【7】締め文の改善
  { from: /念頭に置いて馬券を組み立てたい。/g,
    to: '出馬表で照らし合わせて買い目を絞りたい。' },
  { from: /このことを念頭に置き、?/g,      to: '' },
  { from: /データという確かな根拠を手に[、、]?/g, to: '' },
  { from: /データという客観的な羅針盤を手に[、、]?/g, to: '' },
  { from: /長期的な回収率の底上げを可能にする。/g,
    to: '回収率の安定につながる考え方だ。' },
];

// ─── 段落レベルの「かなり」過剰使用修正 ──────────────────────────

function reduceDuplicateKanari(paragraph) {
  const KANARI_SYNONYMS = [
    'かなり', '顕著に', '際立って', '大幅に', '明確に', '数値上',
  ];
  const matches = [...paragraph.matchAll(/かなり/g)];
  if (matches.length <= 2) return paragraph;

  let count = 0;
  return paragraph.replace(/かなり/g, (match) => {
    count++;
    if (count === 1) return 'かなり';
    if (count === 2) return '顕著に';
    if (count === 3) return '大幅に';
    return '明確に'; // 4回目以降
  });
}

// ─── メイン処理 ───────────────────────────────────────────────────

function processFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  
  // frontmatterとbodyを分離
  const fmMatch = original.match(/^(---[\s\S]*?---\r?\n)([\s\S]*)$/);
  if (!fmMatch) return { changed: false };
  
  const [, frontmatter, body] = fmMatch;
  let processedBody = body;

  // ルール適用
  for (const rule of TONE_RULES) {
    if (typeof rule.to === 'string') {
      processedBody = processedBody.replace(rule.from, rule.to);
    } else {
      processedBody = processedBody.replace(rule.from, rule.to);
    }
  }

  // 段落ごとの「かなり」過剰使用修正
  processedBody = processedBody
    .split(/\n\n/)
    .map(reduceDuplicateKanari)
    .join('\n\n');

  // 空行の正規化
  processedBody = processedBody
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '');

  const result = frontmatter + processedBody;
  return {
    changed: result !== original,
    content: result,
  };
}

function main() {
  const apply = process.argv.includes('--apply');
  const files = fs.readdirSync(ARTICLES_DIR)
    .filter(f => f.endsWith('.md'))
    .sort();

  const changed = [];
  const errors = [];

  for (const file of files) {
    const fullPath = path.join(ARTICLES_DIR, file);
    try {
      const result = processFile(fullPath);
      if (!result.changed) continue;
      changed.push(file);
      if (apply) {
        fs.writeFileSync(fullPath, result.content, 'utf8');
      }
    } catch (err) {
      errors.push({ file, error: err.message });
    }
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    changedCount: changed.length,
    errorCount: errors.length,
    changed: changed.slice(0, 20), // 最初の20件だけ表示
    errors,
  }, null, 2));

  if (!apply && changed.length > 0) {
    console.log('\n→ 実際に適用するには --apply オプションを付けて実行してください');
  }
}

main();

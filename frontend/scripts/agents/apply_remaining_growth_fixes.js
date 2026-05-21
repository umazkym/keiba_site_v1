const fs = require('fs');
const path = require('path');

const ARTICLES_DIR = path.join(__dirname, '..', '..', 'content', 'articles');

const metadataUpdates = {
  '2025-10-26-ground-condition-impact.md': {
    title: '馬場状態とは？良・稍重・重・不良の違いと予想への使い方',
    description: '馬場状態とは何か、良・稍重・重・不良で時計、脚質、枠順、道悪適性がどう変わるかを整理。競馬予想で確認する順番も解説。',
  },
  '2025-11-11-weight-change-impact-analysis.md': {
    title: '馬体重増減の見方｜プラス・マイナス何kgから注意するか',
    description: '馬体重増減の見方を、プラス体重、マイナス体重、休み明け、成長分、輸送減に分けて解説。競馬予想で評価を変える条件を整理。',
  },
  '2025-10-26-frame-number-analysis.md': {
    title: '枠順・馬番の有利不利｜内枠と外枠をコース別に見る方法',
    description: '枠順と馬番の有利不利を、距離ロス、包まれやすさ、スタート位置、コース形態から整理。内枠有利・外枠有利を判断する手順を解説。',
  },
  '2025-10-26-distance-suitability-data.md': {
    title: '距離適性の見方｜短距離・マイル・中距離・長距離の違い',
    description: '競馬の距離適性を、短距離、マイル、中距離、長距離のペース差、血統、過去成績、距離延長・短縮から判断する方法を解説。',
  },
  '2025-11-09-bloodline-data-analysis.md': {
    title: '血統データの見方｜芝・ダート・距離・馬場適性を読む方法',
    description: '血統データを競馬予想に使うため、芝とダート、距離、馬場状態、コース替わりで見るべきポイントを整理。過信しない使い方も解説。',
  },
};

const phraseReplacements = [
  [/証明される/g, '示される'],
  [/証明する/g, '示す'],
  [/証明/g, '裏付け'],
  [/厚く張るべき/g, '評価を上げる材料になる'],
  [/利益構造が成立する/g, '評価しやすい条件になる'],
  [/利益を生む/g, '判断材料になる'],
  [/利益源/g, '判断材料'],
  [/狙い撃つ/g, '評価する'],
  [/狙い打つ/g, '評価する'],
  [/切り捨てる/g, '評価を下げる'],
  [/消し（買わない）対象/g, '評価を下げる候補'],
  [/馬券購入機械/g, '馬券検討材料'],
  [/搾取/g, '偏り'],
  [/ドブに捨てることに等しい/g, 'リスクが大きい'],
  [/完全に合致/g, 'かなり合致'],
  [/完全に制圧/g, '強い存在感を示している'],
  [/強い存在感を示しているしている/g, '強い存在感を示している'],
  [/日本の芝路線を強い存在感を示している/g, '日本の芝路線で強い存在感を示している'],
  [/極大化/g, '高める'],
  [/高めるする/g, '高める'],
  [/必然である/g, '有力な考え方になる'],
  [/誇示する/g, '示す'],
  [/高騰する/g, '高くなる'],
  [/絶好の穴馬/g, '注目したい穴馬'],
  [/冷徹な判断/g, '落ち着いた判断'],
  [/明確なな/g, '明確な'],
  [/まずは評価を上げる/g, 'まず評価する'],
  [/まずは評価を下げる/g, 'まず慎重に扱う'],
];

function replaceFrontmatterField(markdown, field, value) {
  const lines = markdown.split(/\r?\n/);
  if (lines[0] !== '---') return markdown;

  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === '---') {
      end = i;
      break;
    }
  }
  if (end < 0) return markdown;

  const fieldIndex = lines.findIndex((line, index) => index > 0 && index < end && line.startsWith(`${field}:`));
  if (fieldIndex < 0) return markdown;

  if (field === 'description') {
    lines[fieldIndex] = 'description: >-';
    let removeTo = fieldIndex + 1;
    while (removeTo < end && /^\s+/.test(lines[removeTo])) {
      removeTo += 1;
    }
    lines.splice(fieldIndex + 1, removeTo - fieldIndex - 1, `  ${value}`);
  } else {
    lines[fieldIndex] = `${field}: ${value}`;
  }

  return lines.join('\n');
}

function hasDataLanguage(markdown) {
  return /(勝率|複勝率|回収率|データ|分析|ランキング|枠順|馬体重|馬場|騎手|血統|距離|コース|偏差値)/u.test(markdown);
}

function buildConditionBox(filename, markdown) {
  const isGuide = /(beginners|terms|ticket|racecourse-access|calendar|paddock|odds|manual|guide)/i.test(filename);
  const body = isGuide && !hasDataLanguage(markdown)
    ? [
        '本記事は、JRAと地方競馬で一般的に使われるルール・用語・観戦手順を整理し、UMA-FREE内のレース分析で確認しやすい順番に並べています。',
        '数値や例示がある場合は、公開済みの過去レース傾向を補助材料として扱い、特定の馬券購入を推奨するものではありません。',
      ]
    : [
        '本記事の数値は、UMA-FREEが保有する過去レース傾向をもとに、コース、距離、馬場状態、人気、枠順、騎手、血統などの記事テーマに関係する条件で整理しています。',
        '出走取消、競走除外、欠損の大きいデータ、極端な少頭数のレースは、集計から除外または参考扱いにしています。数値は記事公開時点の分析用集計であり、的中や回収を保証するものではありません。',
      ];

  return [
    '## この記事で扱う集計条件',
    '',
    ...body.map((line) => `> ${line}`),
    '',
  ].join('\n');
}

function insertConditionBox(filename, markdown) {
  if (markdown.includes('## この記事で扱う集計条件')) return markdown;

  const frontmatterEnd = markdown.indexOf('\n---', 3);
  if (frontmatterEnd < 0) return markdown;

  const firstHeading = markdown.indexOf('\n## ', frontmatterEnd + 4);
  if (firstHeading < 0) return markdown;

  const box = buildConditionBox(filename, markdown);
  return `${markdown.slice(0, firstHeading).trimEnd()}\n\n${box}${markdown.slice(firstHeading + 1)}`;
}

let touched = 0;

for (const filename of fs.readdirSync(ARTICLES_DIR).filter((name) => name.endsWith('.md'))) {
  const filepath = path.join(ARTICLES_DIR, filename);
  let markdown = fs.readFileSync(filepath, 'utf8');
  const original = markdown;

  const metadata = metadataUpdates[filename];
  if (metadata) {
    markdown = replaceFrontmatterField(markdown, 'title', metadata.title);
    markdown = replaceFrontmatterField(markdown, 'description', metadata.description);
  }

  for (const [pattern, replacement] of phraseReplacements) {
    markdown = markdown.replace(pattern, replacement);
  }

  markdown = insertConditionBox(filename, markdown);
  markdown = markdown.replace(/(的中や回収を保証するものではありません。)\n## /g, '$1\n\n## ');

  if (markdown !== original) {
    fs.writeFileSync(filepath, `${markdown.trimEnd()}\n`, 'utf8');
    touched += 1;
  }
}

console.log(`[GrowthFixes] updated ${touched} article files.`);

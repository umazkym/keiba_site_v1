const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const ARTICLES_DIR = path.join(__dirname, '..', '..', 'content', 'articles');

const BOILERPLATE_HEADINGS = [
  '直前に見る3つの確認材料',
  '買い目へ移す3つの順序',
  '出馬表で確認したい3つの条件',
  '人気を疑う3つの場面',
  '馬場変化で見る3つのズレ',
  '最後に残す3つの優先順位',
];

const REPETITIVE_DESCRIPTION =
  '勝率、回収率、枠順や騎手の傾向を分けて見て、買い・抑え・見送りの判断を整理します。';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compactWhitespace(value) {
  return value.replace(/\n{3,}/g, '\n\n').trim();
}

function removeBoilerplateSections(content) {
  let result = content.replace(/\r\n/g, '\n');
  const removed = [];

  for (const heading of BOILERPLATE_HEADINGS) {
    const pattern = new RegExp(
      `\\n##\\s+${escapeRegExp(heading)}\\s*\\n[\\s\\S]*?(?=\\n##\\s+|$)`,
      'g'
    );
    result = result.replace(pattern, (match) => {
      removed.push(heading);
      return '\n';
    });
  }

  return { content: compactWhitespace(result), removed };
}

function replacementDescription(themeCluster) {
  switch (themeCluster) {
    case 'jockey_data':
      return '騎乗回数、勝率、人気とのズレを分け、軸候補と相手候補の線引きを確認できます。';
    case 'grade_race_preview':
      return '枠順、脚質、AI偏差値を分け、買い足す条件と評価を下げる条件を確認できます。';
    case 'waku_data':
    case 'asset':
    case 'seasonal':
      return '内外の枠差、複勝率、回収率を分け、軸にしやすい枠と割り引く枠を確認できます。';
    default:
      return '数字の強弱と当日の確認材料を分け、出馬表で使う判断軸を確認できます。';
  }
}

function repairDescription(data) {
  const description = String(data.description || '');
  if (!description.includes(REPETITIVE_DESCRIPTION)) {
    return false;
  }

  data.description = compactWhitespace(
    description.replace(REPETITIVE_DESCRIPTION, replacementDescription(data.theme_cluster))
  );
  if (data.og_description && String(data.og_description).includes(REPETITIVE_DESCRIPTION)) {
    data.og_description = compactWhitespace(
      String(data.og_description).replace(REPETITIVE_DESCRIPTION, replacementDescription(data.theme_cluster))
    );
  }
  return true;
}

function main() {
  const apply = process.argv.includes('--apply');
  const files = fs.readdirSync(ARTICLES_DIR).filter((file) => file.endsWith('.md')).sort();
  const changes = [];

  for (const file of files) {
    const fullPath = path.join(ARTICLES_DIR, file);
    const original = fs.readFileSync(fullPath, 'utf8');
    const parsed = matter(original);
    const removedResult = removeBoilerplateSections(parsed.content);
    const descriptionChanged = repairDescription(parsed.data);

    if (removedResult.removed.length === 0 && !descriptionChanged) {
      continue;
    }

    const next = matter.stringify(`${removedResult.content}\n`, parsed.data);
    changes.push({
      file,
      removed: [...new Set(removedResult.removed)],
      descriptionChanged,
      beforeLength: parsed.content.replace(/\s/g, '').length,
      afterLength: removedResult.content.replace(/\s/g, '').length,
    });

    if (apply && next !== original) {
      fs.writeFileSync(fullPath, next, 'utf8');
    }
  }

  console.log(JSON.stringify({ apply, changedFiles: changes.length, changes }, null, 2));
}

main();

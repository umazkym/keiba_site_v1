import matter from 'gray-matter';
import { autoRepairDraftMarkdown } from './agent_editor';
import { checkSEO } from './seo_checker';

const autoRepairFiller = Array.from(
  { length: 150 },
  (_, index) => `確認材料${index}では、枠順、馬場、脚質を分け、当日の出馬表と照合する。`,
).join('\n');

const shortRaceUpdateDraft = `---
title: "皐月賞2026｜枠順と馬場で見る直前確認ポイント3点"
description: "皐月賞2026の出馬表を確認する前に、枠順、馬場、脚質の順番を整理します。ニュース後に買い目へ反映する条件と評価を下げる条件を分け、直前の判断材料を確認できます。"
keywords: ["皐月賞2026", "AI予想", "枠順"]
target_keyword: "皐月賞2026 ニュース データ確認"
theme_cluster: "race_update"
category: "重賞攻略"
article_type: "race_update"
draft: true
---

皐月賞2026では、まず中山芝2000mで位置取り、馬場、脚質の3点を確認したい。ニュースで気になる馬が出てきても、出馬表で条件がそろっているかを見ないまま軸に置くのは早い。

## 中山芝2000mで見る3つの材料

中山芝2000mはスタート後の位置取りとコーナーの入り方が判断を左右しやすい。内で運べる馬はロスを抑えやすいが、包まれると進路を探す時間が必要になる。外枠の馬は距離ロスを受けやすい一方、前へ行けるなら不利を小さくできる。

| 確認項目 | 見る理由 |
| :--- | :--- |
| 枠順 | 位置取りと距離ロスを確認するため |
| 馬場 | 内外の伸びと脚質評価を分けるため |
| 脚質 | 隊列と仕掛けのタイミングを見るため |

${autoRepairFiller}

## このレースで確認したい判断材料

- 確認: 枠順と脚質がかみ合う馬は最初に見る。
- 相手候補: 馬場が向く馬は候補として残す。
- 慎重: 話題性だけで人気が先行する馬は評価を見直す。

最新の出馬表とAI予想は [今日のAI予想・出馬表](/races/today) で無料公開中。
`;

const repaired = autoRepairDraftMarkdown(shortRaceUpdateDraft).content;
const parsed = matter(repaired);
const bodyLength = parsed.content.replace(/\s/g, '').length;
const result = checkSEO(repaired);

console.log({
  bodyLength,
  passed: result.passed,
  errors: result.errors,
});

if (!result.passed) {
  process.exitCode = 1;
}

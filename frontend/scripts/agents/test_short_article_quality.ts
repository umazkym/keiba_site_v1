import { checkSEO } from './seo_checker';

const conciseButSufficient = `---
title: "中山芝1600mの馬場と位置取りを確認する当日チェックの順番"
description: "中山芝1600mで馬場と位置取りは何を確認すればよいか。確認時点と当日の出馬表を分け、公開済みの条件だけで比較する順番を整理します。未発表の枠順や予測を補わず、馬場発表後に見直す項目、判断を保留したい条件、更新後に読む順番と確認方法も短く示します。"
target_keyword: "中山芝1600m 馬場 位置取り"
theme_cluster: "course_venue"
draft: true
---

中山芝1600mでは、2026年9月21日9時時点で確認できる馬場と位置取りの条件を先に分ける。未発表の枠順や予測は加えず、出馬表の更新後に同じ条件で見直す。馬場の内外差と最初のコーナーまでの運び方は、当日の発表と出馬表で確認する。どちらかが未発表なら、その項目を前提に結論を出さない。
`;

const result = checkSEO(conciseButSufficient);
if (!result.passed) {
  throw new Error(`短い事実記事が字数・形式だけで不合格になりました: ${result.errors.join(' / ')}`);
}

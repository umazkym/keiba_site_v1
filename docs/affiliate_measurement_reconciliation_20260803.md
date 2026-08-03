# 楽天競馬クリック計測の照合基準

更新日: 2026-08-03

## 現状

- TrafficGate／リンクシェア側は517クリック、発生0件。
- Clarityは`affiliate_click`が発生した11セッション。
- この2値は定義と期間が異なるため、517対11を欠損率として扱わない。

## 数値の定義

| ソース | 数えるもの | 重複の扱い |
| --- | --- | --- |
| TrafficGate | アフィリエイトURLを通過した外部リダイレクト | 同じ利用者の反復クリックを含み得る |
| GA4 `affiliate_click` | UMA-FREE上でCTAが押されたイベント | クリックごとのイベント総数と利用者数を分けて取得 |
| Clarity `affiliate_click` | 対象イベントが1回以上ある録画セッション | クリック総数ではなくイベント発生セッション数 |

## 今後の照合方法

1. JSTの開始日と終了日を完全にそろえる。
2. GA4は`eventName=affiliate_click`かつ`provider=rakuten_keiba`に限定する。
3. `context`、`campaign_id`、`link_id`別のイベント総数と利用者数を保存する。
4. TrafficGateは同じ期間のクリック数と発生件数を保存する。
5. Clarityは誤タップ、クイックバック、CTA周辺の録画確認に使い、TrafficGateクリックとの一致判定には使わない。
6. `NEXT_PUBLIC_RAKUTEN_KEIBA_MODE=qualified_nar`へ切り替えた後は、それ以前のヘッダー、JRA、日別下部のクリックを実験母数へ混ぜない。

週次`monetization-report.v1`には、`affiliate_impression`、`affiliate_click`、提供元、配置、施策、リンク別の内訳と上記定義を保存する。TrafficGate側に配置別サブIDがないため、配置の正はGA4の`context`とする。

2026-08-03にGA4へ`campaign_id`、`link_id`、`entry_source`をイベントスコープで登録した。過去の517クリックには遡及しないため、次の比較期間は登録日より後の完全日から始める。TrafficGateの同期間CSVがない週は、GA4とClarityだけで成果0件の原因を確定しない。

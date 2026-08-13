#!/usr/bin/env python3
"""GitHub Actions向けに週次収益分析XLSXを生成する。

ローカルでの詳細な描画検証はArtifact Tool版
``scripts/reports/build_monetization_workbook.mjs``を正本とする。この実装は
Actions上で同じ12シート契約を途切れさせないための移植版。
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

import xlsxwriter


SHEETS = (
    "経営ダッシュボード", "週次推移", "流入源", "検索機会", "重賞記事",
    "広告収益", "YouTube・SNS", "障害", "ファネル", "改善台帳",
    "取得品質", "原本",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--analysis", type=Path, required=True)
    parser.add_argument("--history", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def rows_for(history: Mapping[str, Any], source: str, dataset: str | None = None):
    for row in history.get("rows") or []:
        if row.get("source") != source:
            continue
        if dataset is not None and row.get("dataset") != dataset:
            continue
        yield row


def metric(row: Mapping[str, Any], name: str) -> Any:
    return (row.get("metrics") or {}).get(name)


def json_cell(value: Any) -> str:
    return json.dumps(value or {}, ensure_ascii=False, separators=(",", ":"))


def main() -> int:
    args = parse_args()
    analysis = json.loads(args.analysis.read_text(encoding="utf-8-sig"))
    history = json.loads(args.history.read_text(encoding="utf-8-sig"))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    workbook = xlsxwriter.Workbook(args.output)
    workbook.set_properties({"title": "UMA-FREE 週次収益改善", "company": "UMA-FREE"})
    title = workbook.add_format({"bold": True, "font_color": "white", "bg_color": "#163A5F", "font_size": 16})
    header = workbook.add_format({"bold": True, "font_color": "white", "bg_color": "#0F766E", "border": 1, "text_wrap": True})
    cell = workbook.add_format({"border": 1, "border_color": "#E5E7EB", "valign": "top"})
    wrap = workbook.add_format({"border": 1, "border_color": "#E5E7EB", "valign": "top", "text_wrap": True})
    money = workbook.add_format({"num_format": "¥#,##0.00", "border": 1, "border_color": "#E5E7EB"})
    rate = workbook.add_format({"num_format": "0.00%", "border": 1, "border_color": "#E5E7EB"})
    date_fmt = workbook.add_format({"num_format": "yyyy-mm-dd", "border": 1, "border_color": "#E5E7EB"})
    worksheets = {name: workbook.add_worksheet(name) for name in SHEETS}

    def setup(name: str, subtitle: str, columns: Sequence[tuple[str, int]], rows: Iterable[Sequence[Any]]) -> None:
        ws = worksheets[name]
        ws.hide_gridlines(2)
        ws.freeze_panes(4, 0)
        ws.merge_range(0, 0, 0, max(0, len(columns) - 1), name, title)
        ws.merge_range(1, 0, 1, max(0, len(columns) - 1), subtitle, wrap)
        for column, (label, width) in enumerate(columns):
            ws.write(3, column, label, header)
            ws.set_column(column, column, width)
        for row_index, values in enumerate(rows, start=4):
            if row_index >= 1_048_575:
                break
            for column, value in enumerate(values):
                selected = cell
                label = columns[column][0]
                if "収益" in label or "RPM" in label:
                    selected = money
                elif label in {"CTR", "基準CTR", "カバレッジ", "視認率", "前週比"}:
                    selected = rate
                elif "日" in label and isinstance(value, str) and len(value) >= 10:
                    selected = date_fmt
                elif isinstance(value, str) and len(value) > 80:
                    selected = wrap
                ws.write(row_index, column, value, selected)
        if columns:
            ws.autofilter(3, 0, min(1_048_575, row_index if 'row_index' in locals() else 3), len(columns) - 1)

    periods = [
        ("対象週", analysis.get("current_week") or {}),
        ("前週", analysis.get("previous_week") or {}),
        ("直近28日", analysis.get("rolling_28_days") or {}),
        ("3/14以降", analysis.get("cumulative_since_2026_03_14") or {}),
    ]
    weekly_rows = [[
        label, row.get("start_date"), row.get("end_date"), row.get("adsense_revenue_jpy"),
        row.get("adsense_page_views"), row.get("page_rpm_jpy"), row.get("ga4_sessions"),
        row.get("ga4_page_views"), row.get("page_views_per_session"), row.get("gsc_clicks"),
        row.get("gsc_impressions"), row.get("workflow_failures"),
    ] for label, row in periods]
    setup("週次推移", "正式週・前週・28日・累積を分離", [
        ("期間", 12), ("開始日", 12), ("終了日", 12), ("収益", 12), ("PV", 12),
        ("Page RPM", 12), ("セッション", 12), ("GA4 PV", 12), ("PV/セッション", 14),
        ("GSCクリック", 12), ("GSC表示", 12), ("Workflow失敗", 14),
    ], weekly_rows)

    dashboard = worksheets["経営ダッシュボード"]
    dashboard.hide_gridlines(2)
    dashboard.merge_range("A1:L1", "UMA-FREE 収益改善ダッシュボード", title)
    dashboard.write("A3", "対象週")
    dashboard.write("B3", f"{analysis['formal_week']['start_date']}〜{analysis['formal_week']['end_date']}")
    dashboard.write("A4", "正式週")
    dashboard.write("B4", "はい" if analysis["formal_week"]["formal"] else "いいえ（参考集計）")
    dashboard.write_row("A6", ["指標", "対象週", "前週", "前週比"], header)
    keys = (("AdSense収益", "adsense_revenue_jpy"), ("Page RPM", "page_rpm_jpy"),
            ("GA4セッション", "ga4_sessions"), ("GSCクリック", "gsc_clicks"))
    for index, (label, key) in enumerate(keys, start=6):
        dashboard.write(index, 0, label, cell)
        dashboard.write_formula(index, 1, f"='週次推移'!{chr(68 if key == 'adsense_revenue_jpy' else 70 if key == 'page_rpm_jpy' else 71 if key == 'ga4_sessions' else 74)}5", money if "収益" in label or "RPM" in label else cell)
        dashboard.write(index, 2, (analysis.get("previous_week") or {}).get(key), money if "収益" in label or "RPM" in label else cell)
        dashboard.write(index, 3, (analysis.get("week_over_week") or {}).get(key), rate)
    dashboard.write("A13", "今週の最重要仮説", header)
    dashboard.merge_range("A14:F16", (analysis.get("selected_hypothesis") or {}).get("hypothesis") or "データ不足のため変更なし", wrap)
    dashboard.write("G13", "次の安全な確認", header)
    dashboard.merge_range("G14:L16", (analysis.get("selected_hypothesis") or {}).get("recommended_action") or "取得品質を確認", wrap)
    clarity = analysis.get("clarity_72h_snapshot") or {}
    dashboard.merge_range("G19:L19", "Clarity直近72時間（週次値ではありません）", header)
    dashboard.write_row("G20", [
        "人セッション推定", clarity.get("human_session_estimate"),
        "Dead click率", clarity.get("dead_click_rate"),
        "Script error率", clarity.get("script_error_rate"),
    ], cell)
    dashboard.write_row("G21", [
        "Quickback率", clarity.get("quickback_rate"),
        "平均Scroll depth", clarity.get("average_scroll_depth"),
        "Active time比率", clarity.get("active_time_share"),
    ], cell)
    dashboard.set_column("A:A", 22)
    dashboard.set_column("B:L", 16)
    replacement = analysis.get("grade_article_weekly_replacement") or {}
    youtube_recovery = ((analysis.get("traffic_cross_analysis") or {}).get("youtube_site_recovery") or {})
    dashboard.merge_range("G25:L25", "重賞補充率とYouTube回復寄与", header)
    dashboard.write_row("G26", [
        "重賞補充率", replacement.get("replacement_rate"),
        "未補充クリック", replacement.get("unreplaced_clicks"),
        "判定", replacement.get("status") or "unavailable",
    ], cell)
    dashboard.write_row("G27", [
        "YouTube視聴", youtube_recovery.get("youtube_views"),
        "YouTube参照セッション", youtube_recovery.get("youtube_source_sessions"),
        "50件線", "到達" if youtube_recovery.get("site_recovery_supported") else "未到達",
    ], cell)
    reconciliation = analysis.get("revenue_reconciliation") or {}
    reconciliation_status = "通貨不一致" if reconciliation.get("status") == "currency_mismatch" else reconciliation.get("status") or "unavailable"
    dashboard.merge_range("G30:L30", "収益値の通貨と照合", header)
    dashboard.write_row("G31", [
        "AdSense正本", reconciliation.get("adsense_revenue_jpy"), "通貨", "JPY",
        "照合状態", reconciliation_status,
    ], cell)
    dashboard.write_row("G32", [
        "GA4帰属値", reconciliation.get("ga4_ad_revenue"), "通貨",
        reconciliation.get("ga4_revenue_currency") or "未取得", "差分率",
        reconciliation.get("difference_rate"),
    ], cell)
    dashboard.write_row("G33", [
        "ルール", "通貨一致時のみ比較", "基準", "5%超は要照合", "為替換算", "未実施",
    ], cell)
    chart = workbook.add_chart({"type": "column"})
    chart.add_series({"name": "収益", "categories": "='週次推移'!$A$5:$A$6", "values": "='週次推移'!$D$5:$D$6"})
    chart.set_title({"name": "対象週と前週の収益"})
    dashboard.insert_chart("A19", chart, {"x_scale": 1.4, "y_scale": 1.2})

    ga4_currency = (analysis.get("current_week") or {}).get("ga4_revenue_currency") or "媒体通貨"
    setup("流入源", f"GA4参照元・メディア・チャネル別。収益通貨={ga4_currency}", [
        ("日付", 12), ("チャネル", 20), ("参照元/メディア", 28), ("セッション", 12),
        ("PV", 12), ("ユーザー", 12), ("エンゲージ", 14), (f"収益({ga4_currency})", 14),
    ], ([row.get("date"), (row.get("dimensions") or {}).get("sessionDefaultChannelGroup"),
         (row.get("dimensions") or {}).get("sessionSourceMedium"), metric(row, "sessions"),
         metric(row, "screenPageViews"), metric(row, "activeUsers"), metric(row, "engagedSessions"),
         metric(row, "totalAdRevenue")] for row in rows_for(history, "ga4", "acquisition")))
    setup("検索機会", "順位帯CTRとの差から推定。因果効果ではありません。", [
        ("ページ", 48), ("クエリ", 28), ("端末", 12), ("クリック", 10), ("表示", 12),
        ("CTR", 10), ("順位", 10), ("基準CTR", 10), ("推定逸失クリック", 16),
    ], ([row.get("page"), row.get("query"), row.get("device"), row.get("clicks"),
         row.get("impressions"), row.get("ctr"), row.get("position"), row.get("benchmark_ctr"),
         row.get("estimated_missed_clicks")] for row in analysis.get("search_opportunities") or []))
    setup("重賞記事", "需要別の公開期限と開催D-21〜D+3で検索・流入・収益を判定", [
        ("開催日", 12), ("重賞", 24), ("格", 9), ("区分", 10), ("記事URL", 44),
        ("初回commit日", 13), ("公開目安日", 13), ("先行日数", 10), ("過去GSC表示", 13),
        ("GSC表示", 11), ("GSCクリック", 11),
        ("CTR", 10), ("GA4セッション", 14), (f"GA4収益({ga4_currency})", 14), ("判定", 28),
    ], ([row.get("race_date"), row.get("race_name"), row.get("grade"), row.get("circuit"),
         row.get("article_url"), row.get("first_commit_date"), row.get("expected_initial_publish_date"),
         row.get("initial_publish_lead_days"), row.get("historical_gsc_impressions"),
         row.get("gsc_impressions_d21_d3"), row.get("gsc_clicks_d21_d3"), row.get("gsc_ctr_d21_d3"),
         row.get("ga4_sessions_d21_d3"), row.get("ga4_ad_revenue_d21_d3"), row.get("classification")]
        for row in analysis.get("grade_race_assessment") or []))
    setup("広告収益", "AdSenseの形式・配置・チャネル・端末・流入元別", [
        ("日付", 12), ("内訳", 16), ("ディメンション", 40), ("収益", 11), ("PV", 10),
        ("表示", 10), ("クリック", 10), ("Page RPM", 12), ("広告RPM", 12),
        ("リクエスト", 12), ("カバレッジ", 12), ("視認率", 12),
    ], ([row.get("date"), row.get("dataset"), json_cell(row.get("dimensions")), metric(row, "estimated_earnings"),
         metric(row, "page_views"), metric(row, "impressions"), metric(row, "clicks"),
         metric(row, "page_views_rpm"), metric(row, "impressions_rpm"), metric(row, "ad_requests"),
         metric(row, "ad_requests_coverage"), metric(row, "active_view_viewability")]
        for row in rows_for(history, "adsense") if row.get("dataset") != "daily"))
    setup("YouTube・SNS", "動画・投稿Workflow・GA4 UTMを照合", [
        ("日付", 12), ("媒体", 18), ("内訳", 20), ("ディメンション", 48),
        ("視聴", 10), ("表示", 10), ("CTR", 10), ("視聴分", 10), ("失敗", 10), ("状態", 12),
    ], ([row.get("date"), row.get("source"), row.get("dataset"), json_cell(row.get("dimensions")),
         metric(row, "views"), metric(row, "impressions"), metric(row, "impressionClickThroughRate"),
         metric(row, "estimatedMinutesWatched"), metric(row, "failed"), row.get("status")]
        for row in history.get("rows") or [] if row.get("source") in {"youtube", "github_actions"}))
    media = worksheets["YouTube・SNS"]
    media.write_row("L4", ["クロス指標", "対象週"], header)
    media.write_row("L5", ["YouTube視聴", youtube_recovery.get("youtube_views")], cell)
    media.write_row("L6", ["YouTube参照セッション", youtube_recovery.get("youtube_source_sessions")], cell)
    media.write_row("L7", ["Organic Videoセッション", youtube_recovery.get("organic_video_sessions")], cell)
    media.write_row("L8", ["YouTube UTM欠損率", youtube_recovery.get("utm_missing_rate")], cell)
    media.write_row("L9", ["レース到達媒体帰属", youtube_recovery.get("race_funnel_attribution_status") or "unavailable"], cell)
    media.write_row("L10", ["暫定回復線", youtube_recovery.get("minimum_weekly_site_sessions", 50)], cell)
    media.write_row("L11", ["回復線到達", "はい" if youtube_recovery.get("site_recovery_supported") else "いいえ"], cell)
    setup("障害", "失敗日と流入・収益の時系列を照合。相関と因果を分離。", [
        ("発生日時", 20), ("Workflow", 30), ("Job", 28), ("結果", 12), ("失敗ステップ", 45), ("URL", 45),
    ], ([row.get("created_at"), row.get("workflow"), row.get("job"), row.get("conclusion"),
         " / ".join(row.get("failed_steps") or []), row.get("url")]
        for row in analysis.get("github_failure_jobs") or []))
    failure_impact = analysis.get("workflow_failure_impact") or {}
    errors = worksheets["障害"]
    errors.write_row("H4", ["対象週の影響指標", "値"], header)
    errors.write_row("H5", ["全失敗run", failure_impact.get("all_failure_runs")], cell)
    errors.write_row("H6", ["記事Pipeline失敗", failure_impact.get("article_pipeline_failures")], cell)
    errors.write_row("H7", ["Draft・Review失敗", failure_impact.get("draft_review_failures")], cell)
    errors.write_row("H8", ["繰返し失敗", "はい" if failure_impact.get("repeated_draft_review_failure") else "いいえ"], cell)
    events = {"article_read_complete", "article_race_click", "race_view", "prediction_table_view", "race_navigation", "ad_impression_custom"}
    setup("ファネル", "検索表示→記事→レース→予想表→移動→広告表示", [
        ("日付", 12), ("イベント", 28), ("件数", 12), ("ユーザー", 12),
    ], ([row.get("date"), (row.get("dimensions") or {}).get("eventName"), metric(row, "eventCount"), metric(row, "totalUsers")]
        for row in rows_for(history, "ga4", "events") if (row.get("dimensions") or {}).get("eventName") in events))
    setup("改善台帳", "毎週1仮説・1変更。自動変更はローカル検証まで。", [
        ("順位", 8), ("分類", 20), ("仮説", 42), ("確信度", 12), ("根拠", 48), ("反証", 48), ("次の確認", 44),
    ], ([index, row.get("category"), row.get("hypothesis"), row.get("confidence"), row.get("evidence"),
         row.get("counterevidence"), row.get("recommended_action")]
        for index, row in enumerate(analysis.get("root_causes") or [], start=1)))
    setup("取得品質", "complete / partial / unavailable / failed。欠損は0と別管理。", [
        ("媒体", 24), ("状態", 14), ("行数", 12), ("理由・内訳", 70),
    ], ([name, value.get("status"), value.get("row_count"), json_cell(value.get("reports") or value.get("reason"))]
        for name, value in (analysis.get("source_status") or {}).items()))
    setup("原本", "正規化行。媒体別の変更前原本JSONもartifactへ保存。", [
        ("source", 20), ("dataset", 24), ("date", 12), ("status", 12), ("dimensions", 60),
        ("metrics", 60), ("lineage", 48), ("freshness", 24),
    ], ([row.get("source"), row.get("dataset"), row.get("date"), row.get("status"),
         json_cell(row.get("dimensions")), json_cell(row.get("metrics")), row.get("lineage"), row.get("freshness")]
        for row in history.get("rows") or []))
    workbook.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

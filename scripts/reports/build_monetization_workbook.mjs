import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const args = process.argv.slice(2);
const valueOf = (name, fallback = "") => {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : fallback;
};

const analysisPath = path.resolve(valueOf("--analysis"));
const historyPath = path.resolve(valueOf("--history"));
const outputPath = path.resolve(valueOf("--output"));
const validationPath = path.resolve(valueOf("--validation", `${outputPath}.validation.json`));
const renderDir = path.resolve(valueOf("--render-dir", path.join(path.dirname(outputPath), "renders")));

if (!valueOf("--analysis") || !valueOf("--history") || !valueOf("--output")) {
  throw new Error("--analysis、--history、--outputは必須です。");
}

const analysis = JSON.parse(await fs.readFile(analysisPath, "utf8"));
const history = JSON.parse(await fs.readFile(historyPath, "utf8"));
const ga4Currency = analysis.current_week?.ga4_revenue_currency || "媒体通貨";
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.mkdir(renderDir, { recursive: true });

const wb = Workbook.create();
const sheetNames = [
  "経営ダッシュボード",
  "週次推移",
  "流入源",
  "検索機会",
  "重賞記事",
  "広告収益",
  "YouTube・SNS",
  "障害",
  "ファネル",
  "改善台帳",
  "取得品質",
  "原本",
];
const sheets = Object.fromEntries(sheetNames.map((name) => [name, wb.worksheets.add(name)]));
for (const sheet of Object.values(sheets)) sheet.showGridLines = false;

const navy = "#163A5F";
const teal = "#0F766E";
const sky = "#E8F1F8";
const green = "#DCFCE7";
const amber = "#FEF3C7";
const red = "#FEE2E2";
const gray = "#F3F4F6";
const line = "#CBD5E1";

const styleTitle = (sheet, range, title, subtitle = "") => {
  sheet.getRange(range).merge();
  sheet.getRange(range.split(":")[0]).values = [[title]];
  sheet.getRange(range).format = {
    fill: navy,
    font: { bold: true, color: "#FFFFFF", size: 16 },
    verticalAlignment: "center",
  };
  sheet.getRange(range).format.rowHeight = 30;
  if (subtitle) {
    const top = Number(range.match(/\d+/)?.[0] || 1) + 1;
    const endColumn = range.split(":")[1].replace(/\d+/g, "");
    const subtitleRange = `A${top}:${endColumn}${top}`;
    sheet.getRange(subtitleRange).merge();
    sheet.getRange(`A${top}`).values = [[subtitle]];
    sheet.getRange(subtitleRange).format = {
      fill: sky,
      font: { color: navy, italic: true },
      wrapText: true,
    };
  }
};

const writeTable = (sheet, startRow, headers, rows, options = {}) => {
  const startColumn = options.startColumn || 1;
  const headerRange = sheet.getRangeByIndexes(startRow - 1, startColumn - 1, 1, headers.length);
  headerRange.values = [headers];
  headerRange.format = {
    fill: options.headerFill || teal,
    font: { bold: true, color: "#FFFFFF" },
    wrapText: true,
    verticalAlignment: "center",
    borders: { preset: "outside", style: "thin", color: line },
  };
  if (rows.length) {
    const dataRange = sheet.getRangeByIndexes(startRow, startColumn - 1, rows.length, headers.length);
    dataRange.values = rows;
    dataRange.format = {
      borders: {
        insideHorizontal: { style: "thin", color: "#E5E7EB" },
        bottom: { style: "thin", color: line },
      },
      verticalAlignment: "top",
    };
  }
  return {
    headerRange,
    dataStartRow: startRow + 1,
    dataEndRow: startRow + rows.length,
  };
};

const metric = (row, ...names) => {
  for (const name of names) {
    const value = row?.metrics?.[name];
    if (value !== null && value !== undefined && value !== "") return Number(value);
  }
  return null;
};

const rawRowsPerDataset = 200;
const rawDatasetCounts = new Map();
const sampledHistoryRows = (history.rows || []).filter((row) => {
  const key = `${row.source || "unknown"}::${row.dataset || "unknown"}`;
  const count = rawDatasetCounts.get(key) || 0;
  if (count >= rawRowsPerDataset) return false;
  rawDatasetCounts.set(key, count + 1);
  return true;
});
const normalizedRows = sampledHistoryRows.map((row) => [
  row.source || "",
  row.dataset || "",
  row.date ? new Date(`${String(row.date).slice(0, 10)}T00:00:00Z`) : null,
  row.status || "",
  JSON.stringify(row.dimensions || {}),
  JSON.stringify(row.metrics || {}),
  metric(row, "estimated_earnings"),
  metric(row, "page_views"),
  metric(row, "impressions"),
  metric(row, "clicks"),
  metric(row, "sessions"),
  metric(row, "screenPageViews"),
  metric(row, "totalAdRevenue"),
  metric(row, "eventCount"),
  metric(row, "views"),
  metric(row, "estimatedMinutesWatched"),
  metric(row, "failed"),
  row.lineage || "",
  row.freshness || "",
]);

const raw = sheets["原本"];
styleTitle(
  raw,
  "A1:S1",
  "正規化原本（監査標本）",
  `全${(history.rows || []).length.toLocaleString()}行は同梱artifactのmonetization-history.v2.jsonに保存。XLSXは媒体×datasetごと先頭${rawRowsPerDataset}行を収録し、空欄は未取得で0ではありません。`,
);
const rawHeaders = [
  "source", "dataset", "date", "status", "dimensions_json", "metrics_json",
  "estimated_earnings", "page_views", "impressions", "clicks", "sessions",
  "screen_page_views", "ga4_ad_revenue", "event_count", "youtube_views",
  "youtube_watch_minutes", "workflow_failed", "lineage", "freshness",
];
writeTable(raw, 4, rawHeaders, normalizedRows, { headerFill: navy });
if (normalizedRows.length) {
  raw.getRange(`C5:C${4 + normalizedRows.length}`).format.numberFormat = "yyyy-mm-dd";
  raw.getRange(`G5:Q${4 + normalizedRows.length}`).format.numberFormat = "#,##0.00";
  raw.getRange(`E5:F${4 + normalizedRows.length}`).format.wrapText = false;
}
raw.freezePanes.freezeRows(4);
raw.freezePanes.freezeColumns(3);

const weekly = sheets["週次推移"];
styleTitle(weekly, "A1:L1", "週次推移", "正式週・前週・28日・3月14日以降を分離して表示");
const periods = [
  ["対象週", analysis.current_week],
  ["前週", analysis.previous_week],
  ["直近28日", analysis.rolling_28_days],
  ["3/14以降", analysis.cumulative_since_2026_03_14],
];
const weeklyHeaders = [
  "期間", "開始日", "終了日", "収益(円)", "AdSense PV", "Page RPM(円)",
  "GA4セッション", "GA4 PV", "PV/セッション", "GSCクリック", "GSC表示", "Workflow失敗",
];
const weeklyRows = periods.map(([label, row]) => [
  label,
  row?.start_date ? new Date(`${row.start_date}T00:00:00Z`) : null,
  row?.end_date ? new Date(`${row.end_date}T00:00:00Z`) : null,
  row?.adsense_revenue_jpy ?? null,
  row?.adsense_page_views ?? null,
  row?.page_rpm_jpy ?? null,
  row?.ga4_sessions ?? null,
  row?.ga4_page_views ?? null,
  row?.page_views_per_session ?? null,
  row?.gsc_clicks ?? null,
  row?.gsc_impressions ?? null,
  row?.workflow_failures ?? null,
]);
writeTable(weekly, 4, weeklyHeaders, weeklyRows);
weekly.getRange("B5:C8").format.numberFormat = "yyyy-mm-dd";
weekly.getRange("D5:L8").format.numberFormat = "#,##0.00";
weekly.getRange("N4:O11").values = [
  ["指標", "前週比"],
  ...Object.entries(analysis.week_over_week || {}).map(([key, value]) => [key, value]),
];
weekly.getRange("N4:O4").format = { fill: teal, font: { bold: true, color: "#FFFFFF" } };
weekly.getRange("O5:O20").format.numberFormat = "0.0%";
weekly.freezePanes.freezeRows(4);

const dashboard = sheets["経営ダッシュボード"];
const formal = analysis.formal_week || {};
styleTitle(
  dashboard,
  "A1:L1",
  "UMA-FREE 収益改善ダッシュボード",
  `${formal.start_date || ""}〜${formal.end_date || ""} / ${formal.formal ? "正式週" : "参考集計"}`,
);
dashboard.getRange("A4:L4").merge();
dashboard.getRange("A4").values = [[formal.formal ? "完全な7日データです" : "媒体の日付欠損があるため参考集計です"]];
dashboard.getRange("A4:L4").format = {
  fill: formal.formal ? green : amber,
  font: { bold: true, color: navy },
};

const cards = [
  ["A6:C6", "A7:C9", "AdSense収益", "='週次推移'!D5", "¥#,##0"],
  ["D6:F6", "D7:F9", "Page RPM", "='週次推移'!F5", "¥#,##0"],
  ["G6:I6", "G7:I9", "GA4セッション", "='週次推移'!G5", "#,##0"],
  ["J6:L6", "J7:L9", "GSCクリック", "='週次推移'!J5", "#,##0"],
];
for (const [labelRange, valueRange, label, formula, numberFormat] of cards) {
  dashboard.getRange(labelRange).merge();
  dashboard.getRange(labelRange.split(":")[0]).values = [[label]];
  dashboard.getRange(labelRange).format = { fill: teal, font: { bold: true, color: "#FFFFFF" } };
  dashboard.getRange(valueRange).merge();
  const sourceFormula = formula.slice(1);
  const displayedFormula = numberFormat.startsWith("¥")
    ? `ROUND(${sourceFormula},0)`
    : sourceFormula;
  dashboard.getRange(valueRange.split(":")[0]).formulas = [[`=IF(ISBLANK(${sourceFormula}),"",${displayedFormula})`]];
  dashboard.getRange(valueRange).format = {
    fill: "#FFFFFF",
    font: { bold: true, color: navy, size: 18 },
    numberFormat,
    borders: { preset: "outside", style: "thin", color: line },
    horizontalAlignment: "center",
    verticalAlignment: "center",
  };
}
dashboard.getRange("A7:C9").format.numberFormat = "¥#,##0";
dashboard.getRange("D7:F9").format.numberFormat = "¥#,##0";
dashboard.getRange("G7:L9").format.numberFormat = "#,##0";

dashboard.getRange("A12:F12").merge();
dashboard.getRange("A12").values = [["今週の最重要仮説"]];
dashboard.getRange("A12:F12").format = { fill: navy, font: { bold: true, color: "#FFFFFF" } };
dashboard.getRange("A13:F16").merge();
dashboard.getRange("A13").values = [[analysis.selected_hypothesis?.hypothesis || "取得データ不足のため変更しません"]];
dashboard.getRange("A13:F16").format = { fill: sky, wrapText: true, verticalAlignment: "top" };
dashboard.getRange("G12:L12").merge();
dashboard.getRange("G12").values = [["次の安全な確認"]];
dashboard.getRange("G12:L12").format = { fill: navy, font: { bold: true, color: "#FFFFFF" } };
dashboard.getRange("G13:L16").merge();
dashboard.getRange("G13").values = [[analysis.selected_hypothesis?.recommended_action || "媒体の読取状態を確認"]];
dashboard.getRange("G13:L16").format = { fill: sky, wrapText: true, verticalAlignment: "top" };

const revenueAvailable = [analysis.current_week?.adsense_revenue_jpy, analysis.previous_week?.adsense_revenue_jpy]
  .some((value) => value !== null && value !== undefined);
if (revenueAvailable) {
  const chart = dashboard.charts.add("bar", {
    chartType: "bar",
    title: "対象週と前週の収益比較（円）",
    hasLegend: false,
  });
  const series = chart.series.add("AdSense収益");
  series.categoryFormula = "'週次推移'!$A$5:$A$6";
  series.formula = "'週次推移'!$D$5:$D$6";
  series.fill = teal;
  chart.yAxis = { numberFormatCode: "¥#,##0" };
  chart.setPosition("A19", "F34");
} else {
  dashboard.getRange("A19:F22").merge();
  dashboard.getRange("A19").values = [["AdSense収益が未取得のため比較グラフを表示しません"]];
  dashboard.getRange("A19:F22").format = { fill: gray, font: { color: navy }, verticalAlignment: "center" };
}
const clarity = analysis.clarity_72h_snapshot || {};
dashboard.getRange("G19:L19").merge();
dashboard.getRange("G19").values = [["Clarity直近72時間（週次値ではありません）"]];
dashboard.getRange("G19:L19").format = { fill: navy, font: { bold: true, color: "#FFFFFF" } };
dashboard.getRange("G20:L23").values = [
  ["人セッション推定", clarity.human_session_estimate ?? null, "Dead click率", clarity.dead_click_rate ?? null, "Script error率", clarity.script_error_rate ?? null],
  ["Quickback率", clarity.quickback_rate ?? null, "平均Scroll depth", clarity.average_scroll_depth ?? null, "Active time比率", clarity.active_time_share ?? null],
  ["Botセッション", clarity.bot_sessions ?? null, "Distinct users", clarity.distinct_users ?? null, "Rage click率", clarity.rage_click_rate ?? null],
  ["制約", "APIは最大72時間", "用途", "録画・UX異常の補助証拠", "欠損", "0へ変換しない"],
];
dashboard.getRange("G20:L23").format = { borders: { preset: "inside", style: "thin", color: line } };
dashboard.getRange("H21").format.numberFormat = "0.00%";
dashboard.getRange("J20:J21").format.numberFormat = "0.00%";
dashboard.getRange("L20:L22").format.numberFormat = "0.00%";
const replacement = analysis.grade_article_weekly_replacement || {};
const youtubeRecovery = analysis.traffic_cross_analysis?.youtube_site_recovery || {};
dashboard.getRange("G25:L25").merge();
dashboard.getRange("G25").values = [["重賞補充率とYouTube回復寄与"]];
dashboard.getRange("G25:L25").format = { fill: navy, font: { bold: true, color: "#FFFFFF" } };
dashboard.getRange("G26:L28").values = [
  ["重賞記事クリック補充率", replacement.replacement_rate ?? null, "未補充クリック", replacement.unreplaced_clicks ?? null, "判定", replacement.status || "unavailable"],
  ["YouTube視聴", youtubeRecovery.youtube_views ?? null, "YouTube参照セッション", youtubeRecovery.youtube_source_sessions ?? null, "暫定50件線", youtubeRecovery.site_recovery_supported ? "到達" : "未到達"],
  ["注意", "開催需要差を含む", "用途", "翌週差分の再検証", "因果", "未確定"],
];
dashboard.getRange("H26").format.numberFormat = "0.0%";
const reconciliation = analysis.revenue_reconciliation || {};
const reconciliationStatus = reconciliation.status === "currency_mismatch"
  ? "通貨不一致"
  : reconciliation.status || "unavailable";
dashboard.getRange("G30:L30").merge();
dashboard.getRange("G30").values = [["収益値の通貨と照合"]];
dashboard.getRange("G30:L30").format = { fill: navy, font: { bold: true, color: "#FFFFFF" } };
dashboard.getRange("G31:L33").values = [
  ["AdSense正本", reconciliation.adsense_revenue_jpy ?? null, "通貨", "JPY", "照合状態", reconciliationStatus],
  ["GA4帰属値", reconciliation.ga4_ad_revenue ?? null, "通貨", reconciliation.ga4_revenue_currency || "未取得", "差分率", reconciliation.difference_rate ?? null],
  ["ルール", "通貨一致時のみ比較", "基準", "5%超は要照合", "為替換算", "未実施"],
];
dashboard.getRange("G31:L33").format = { borders: { preset: "inside", style: "thin", color: line } };
dashboard.getRange("H31:H31").format.numberFormat = "¥#,##0";
dashboard.getRange("H32:H32").format.numberFormat = "0.000000";
dashboard.getRange("L32:L32").format.numberFormat = "0.0%";

const causes = (analysis.root_causes || []).map((row, index) => [
  index + 1,
  row.category,
  row.hypothesis,
  row.confidence,
  row.evidence,
  row.counterevidence,
  row.recommended_action,
]);
writeTable(dashboard, 36, ["順位", "分類", "仮説", "確信度", "根拠", "反証", "次の確認"], causes, { headerFill: navy });
dashboard.getRange("C37:G50").format.wrapText = true;
dashboard.freezePanes.freezeRows(4);

const acquisition = (history.rows || [])
  .filter((row) => row.source === "ga4" && row.dataset === "acquisition")
  .map((row) => [
    row.date ? new Date(`${row.date}T00:00:00Z`) : null,
    row.dimensions?.sessionDefaultChannelGroup || "",
    row.dimensions?.sessionSourceMedium || "",
    metric(row, "sessions"),
    metric(row, "screenPageViews"),
    metric(row, "activeUsers"),
    metric(row, "engagedSessions"),
    metric(row, "totalAdRevenue"),
  ]);
const sourceSheet = sheets["流入源"];
styleTitle(sourceSheet, "A1:H1", "流入源", `GA4の参照元・メディア・チャネル別。収益はGA4帰属値（${ga4Currency}）です。`);
writeTable(sourceSheet, 4, ["日付", "チャネル", "参照元/メディア", "セッション", "PV", "ユーザー", "エンゲージ", `広告収益(${ga4Currency})`], acquisition);
if (acquisition.length) {
  sourceSheet.getRange(`A5:A${4 + acquisition.length}`).format.numberFormat = "yyyy-mm-dd";
  sourceSheet.getRange(`D5:H${4 + acquisition.length}`).format.numberFormat = "#,##0.00";
}
sourceSheet.freezePanes.freezeRows(4);

const searchRows = (analysis.search_opportunities || []).map((row) => [
  row.page || "", row.query || "", row.device || "", row.clicks ?? null,
  row.impressions ?? null, row.ctr ?? null, row.position ?? null,
  row.benchmark_ctr ?? null, row.estimated_missed_clicks ?? null,
]);
const searchSheet = sheets["検索機会"];
styleTitle(searchSheet, "A1:I1", "検索機会", "同じ順位帯のCTR中央値との差から推定した改善余地。因果効果ではありません。");
writeTable(searchSheet, 4, ["ページ", "クエリ", "端末", "クリック", "表示", "CTR", "順位", "基準CTR", "推定逸失クリック"], searchRows);
if (searchRows.length) {
  searchSheet.getRange(`F5:F${4 + searchRows.length}`).format.numberFormat = "0.00%";
  searchSheet.getRange(`H5:H${4 + searchRows.length}`).format.numberFormat = "0.00%";
}
searchSheet.freezePanes.freezeRows(4);

const gradeRows = (analysis.grade_race_assessment || []).map((row) => [
  row.race_date ? new Date(`${row.race_date}T00:00:00Z`) : null,
  row.race_name || "", row.grade || "", row.circuit || "", row.article_url || "",
  row.first_commit_date ? new Date(`${row.first_commit_date}T00:00:00Z`) : null,
  row.expected_initial_publish_date ? new Date(`${row.expected_initial_publish_date}T00:00:00Z`) : null,
  row.initial_publish_lead_days ?? null,
  row.historical_gsc_impressions ?? null,
  row.gsc_impressions_d21_d3 ?? null, row.gsc_clicks_d21_d3 ?? null,
  row.gsc_ctr_d21_d3 ?? null, row.ga4_sessions_d21_d3 ?? null,
  row.ga4_ad_revenue_d21_d3 ?? null, row.classification || "",
  row.benchmark?.gsc_impressions_d21_d3 ?? null,
  row.benchmark?.ga4_sessions_d21_d3 ?? null,
  row.article_read_complete_d21_d3 ?? null,
  row.article_race_click_d21_d3 ?? null,
  row.prediction_table_view_d21_d3 ?? null,
  row.ad_impression_d21_d3 ?? null,
]);
const gradeSheet = sheets["重賞記事"];
styleTitle(gradeSheet, "A1:U1", "重賞記事", "需要別の公開期限と開催D-21〜D+3の検索・流入・収益を判定");
writeTable(gradeSheet, 4, ["開催日", "重賞", "格", "区分", "記事URL", "初回commit", "公開目安", "先行日数", "過去GSC表示", "GSC表示", "GSCクリック", "CTR", "GA4セッション", `GA4広告収益(${ga4Currency})`, "判定", "同格GSC表示中央値", "同格GA4セッション中央値", "読了", "記事→レース", "予想表", "広告表示"], gradeRows);
gradeSheet.getRange("W4:X11").values = [
  ["週次補充指標", "値"],
  ["前週重賞記事クリック", replacement.previous_grade_article_clicks ?? null],
  ["対象週重賞記事クリック", replacement.current_grade_article_clicks ?? null],
  ["補充率", replacement.replacement_rate ?? null],
  ["未補充クリック", replacement.unreplaced_clicks ?? null],
  ["目標", replacement.target_rate ?? null],
  ["判定", replacement.status || "unavailable"],
  ["注意", replacement.caveat || ""],
];
gradeSheet.getRange("W4:X4").format = { fill: teal, font: { bold: true, color: "#FFFFFF" } };
gradeSheet.getRange("X7:X7").format.numberFormat = "0.0%";
gradeSheet.getRange("X9:X9").format.numberFormat = "0.0%";
if (gradeRows.length) {
  const gradeEnd = 4 + gradeRows.length;
  gradeSheet.getRange(`A5:A${gradeEnd}`).format.numberFormat = "yyyy-mm-dd";
  gradeSheet.getRange(`F5:G${gradeEnd}`).format.numberFormat = "yyyy-mm-dd";
  gradeSheet.getRange(`L5:L${gradeEnd}`).format.numberFormat = "0.00%";
  gradeSheet.getRange(`O5:O${gradeEnd}`).conditionalFormats.add("containsText", { text: "良好", format: { fill: green } });
  gradeSheet.getRange(`O5:O${gradeEnd}`).conditionalFormats.add("containsText", { text: "不足", format: { fill: amber } });
  gradeSheet.getRange(`O5:O${gradeEnd}`).conditionalFormats.add("containsText", { text: "なし", format: { fill: red } });
}
gradeSheet.freezePanes.freezeRows(4);

const adRows = (history.rows || [])
  .filter((row) => row.source === "adsense" && row.dataset !== "daily")
  .map((row) => [
    row.date ? new Date(`${row.date}T00:00:00Z`) : null,
    row.dataset || "", JSON.stringify(row.dimensions || {}),
    metric(row, "estimated_earnings"), metric(row, "page_views"), metric(row, "impressions"),
    metric(row, "clicks"), metric(row, "page_views_rpm"), metric(row, "impressions_rpm"),
    metric(row, "ad_requests"), metric(row, "ad_requests_coverage"),
    metric(row, "active_view_viewability"),
  ]);
const adSheet = sheets["広告収益"];
styleTitle(adSheet, "A1:L1", "広告収益", "AdSenseを形式・配置・チャネル・端末・流入元で分解");
writeTable(adSheet, 4, ["日付", "内訳", "ディメンション", "収益", "PV", "表示", "クリック", "Page RPM", "広告RPM", "リクエスト", "カバレッジ", "視認率"], adRows);
if (adRows.length) {
  const adEnd = 4 + adRows.length;
  adSheet.getRange(`A5:A${adEnd}`).format.numberFormat = "yyyy-mm-dd";
  adSheet.getRange(`D5:J${adEnd}`).format.numberFormat = "#,##0.00";
  adSheet.getRange(`K5:L${adEnd}`).format.numberFormat = "0.00%";
}
adSheet.freezePanes.freezeRows(4);

const mediaRows = (history.rows || [])
  .filter((row) => ["youtube", "github_actions"].includes(row.source))
  .filter((row) => row.source !== "github_actions" || /SNS|YouTube/i.test(String(row.dimensions?.workflow || "")))
  .map((row) => [
    row.date ? new Date(`${row.date}T00:00:00Z`) : null,
    row.source || "", row.dataset || "", JSON.stringify(row.dimensions || {}),
    metric(row, "views"), metric(row, "impressions"), metric(row, "impressionClickThroughRate"),
    metric(row, "estimatedMinutesWatched"), metric(row, "failed"), row.status || "",
  ]);
const mediaSheet = sheets["YouTube・SNS"];
styleTitle(mediaSheet, "A1:J1", "YouTube・SNS", "動画到達と投稿成功をGA4のUTM流入へつなぐための原本");
writeTable(mediaSheet, 4, ["日付", "媒体", "内訳", "ディメンション", "視聴", "表示", "CTR", "視聴分", "失敗", "状態"], mediaRows);
mediaSheet.getRange("L4:M12").values = [
  ["クロス指標", "対象週"],
  ["YouTube視聴", youtubeRecovery.youtube_views ?? null],
  ["YouTube参照セッション", youtubeRecovery.youtube_source_sessions ?? null],
  ["Organic Videoセッション", youtubeRecovery.organic_video_sessions ?? null],
  ["YouTube UTM欠損率", youtubeRecovery.utm_missing_rate ?? null],
  ["レース到達媒体帰属", youtubeRecovery.race_funnel_attribution_status || "unavailable"],
  ["暫定回復線", youtubeRecovery.minimum_weekly_site_sessions ?? 50],
  ["回復線到達", youtubeRecovery.site_recovery_supported ? "はい" : "いいえ"],
  ["計測", "UTM復旧前後を分離"],
];
mediaSheet.getRange("L4:M4").format = { fill: teal, font: { bold: true, color: "#FFFFFF" } };
mediaSheet.getRange("M8").format.numberFormat = "0.0%";
if (mediaRows.length) {
  const mediaEnd = 4 + mediaRows.length;
  mediaSheet.getRange(`A5:A${mediaEnd}`).format.numberFormat = "yyyy-mm-dd";
  mediaSheet.getRange(`G5:G${mediaEnd}`).format.numberFormat = "0.00%";
}
mediaSheet.freezePanes.freezeRows(4);

const failureRows = (analysis.github_failure_jobs || []).map((row) => [
  row.created_at ? new Date(String(row.created_at)) : null,
  row.workflow || "", row.job || "", row.conclusion || "",
  (row.failed_steps || []).join(" / "), row.url || "",
]);
const errorSheet = sheets["障害"];
styleTitle(errorSheet, "A1:F1", "障害", "Workflow失敗と流入・収益の同時発生を確認。相関だけで因果を断定しません。");
writeTable(errorSheet, 4, ["発生日時", "Workflow", "Job", "結果", "失敗ステップ", "URL"], failureRows, { headerFill: navy });
const failureImpact = analysis.workflow_failure_impact || {};
errorSheet.getRange("H4:I10").values = [
  ["対象週の影響指標", "値"],
  ["全失敗run", failureImpact.all_failure_runs ?? null],
  ["記事Pipeline失敗", failureImpact.article_pipeline_failures ?? null],
  ["Draft・Review失敗", failureImpact.draft_review_failures ?? null],
  ["繰返し失敗", failureImpact.repeated_draft_review_failure ? "はい" : "いいえ"],
  ["失敗日", (failureImpact.article_failure_dates || []).join(" / ")],
  ["注意", failureImpact.note || ""],
];
errorSheet.getRange("H4:I4").format = { fill: teal, font: { bold: true, color: "#FFFFFF" } };
if (failureRows.length) {
  const failureEnd = 4 + failureRows.length;
  errorSheet.getRange(`A5:A${failureEnd}`).format.numberFormat = "yyyy-mm-dd hh:mm";
  errorSheet.getRange(`D5:D${failureEnd}`).conditionalFormats.add("containsText", { text: "failure", format: { fill: red } });
}
errorSheet.freezePanes.freezeRows(4);

const funnelEvents = [
  "article_read_complete", "article_race_click", "race_view", "prediction_table_view",
  "race_navigation", "ad_impression_custom", "ad_viewable_custom", "affiliate_click",
];
const eventRows = (history.rows || [])
  .filter((row) => row.source === "ga4" && row.dataset === "events" && funnelEvents.includes(row.dimensions?.eventName))
  .map((row) => [
    row.date ? new Date(`${row.date}T00:00:00Z`) : null,
    row.dimensions?.eventName || "", metric(row, "eventCount"), metric(row, "totalUsers"),
  ]);
const funnelSheet = sheets["ファネル"];
styleTitle(funnelSheet, "A1:D1", "記事・レース・収益ファネル", "イベント名は変更せず、実ページビューと画面内操作を分離");
writeTable(funnelSheet, 4, ["日付", "イベント", "イベント数", "ユーザー"], eventRows);
if (eventRows.length) funnelSheet.getRange(`A5:A${4 + eventRows.length}`).format.numberFormat = "yyyy-mm-dd";
funnelSheet.freezePanes.freezeRows(4);

const ledgerRows = (analysis.root_causes || []).map((row, index) => [
  index + 1, row.category || "", row.hypothesis || "", row.confidence || "",
  row.evidence || "", row.counterevidence || "", row.recommended_action || "",
  index === 0 ? "今週の1仮説" : "保留", "未実施",
]);
const ledgerSheet = sheets["改善台帳"];
styleTitle(ledgerSheet, "A1:I1", "改善台帳", "毎週1仮説・1変更。公開・広告設定・Git操作は人が判断します。");
writeTable(ledgerSheet, 4, ["順位", "分類", "仮説", "確信度", "根拠", "反証", "次の確認", "扱い", "実施状態"], ledgerRows, { headerFill: navy });
if (ledgerRows.length) ledgerSheet.getRange(`C5:G${4 + ledgerRows.length}`).format.wrapText = true;
ledgerSheet.getRange("I5:I100").dataValidation = { rule: { type: "list", values: ["未実施", "検証中", "完了", "見送り"] } };
ledgerSheet.freezePanes.freezeRows(4);

const qualityRows = Object.entries(analysis.source_status || {}).map(([source, row]) => [
  source, row.status || "", row.row_count ?? 0,
  row.reason || "", JSON.stringify(row.reports || {}),
]);
const qualitySheet = sheets["取得品質"];
styleTitle(qualitySheet, "A1:E1", "取得品質", "欠損・API失敗・期間外は0と区別");
writeTable(qualitySheet, 4, ["媒体", "状態", "行数", "理由", "内訳"], qualityRows, { headerFill: navy });
if (qualityRows.length) {
  const qualityEnd = 4 + qualityRows.length;
  qualitySheet.getRange(`B5:B${qualityEnd}`).conditionalFormats.add("containsText", { text: "complete", format: { fill: green } });
  qualitySheet.getRange(`B5:B${qualityEnd}`).conditionalFormats.add("containsText", { text: "partial", format: { fill: amber } });
  qualitySheet.getRange(`B5:B${qualityEnd}`).conditionalFormats.add("containsText", { text: "unavailable", format: { fill: red } });
  qualitySheet.getRange(`D5:E${qualityEnd}`).format.wrapText = true;
}
qualitySheet.freezePanes.freezeRows(4);

for (const [sheetName, sheet] of Object.entries(sheets)) {
  const used = sheet.getUsedRange();
  if (used) {
    if (sheetName === "原本") {
      // 10万行超の原本へ全行autofitをかけるとCI・ローカルともに時間超過する。
      // 表示確認範囲だけ書式を揃え、列幅は下の明示指定で固定する。
      sheet.getRange("A1:S25").format.font = { name: "Yu Gothic", size: 10 };
    } else {
      used.format.font = { name: "Yu Gothic", size: 10 };
      used.format.autofitColumns();
      used.format.autofitRows();
    }
  }
}

// 読みやすさのため、自動幅の上限を主要列へ明示する。
dashboard.getRange("A1:L60").format.columnWidth = 14;
dashboard.getRange("C37:G60").format.columnWidth = 28;
dashboard.getRange("C37:G60").format.wrapText = true;
dashboard.getRange("A37:G60").format.autofitRows();
sourceSheet.getRange("B1:C10000").format.columnWidth = 22;
searchSheet.getRange(`A1:B${Math.max(5, 4 + searchRows.length)}`).format.columnWidth = 34;
gradeSheet.getRange(`B1:E${Math.max(5, 4 + gradeRows.length)}`).format.columnWidth = 24;
adSheet.getRange(`C1:C${Math.max(5, 4 + adRows.length)}`).format.columnWidth = 34;
mediaSheet.getRange(`D1:D${Math.max(5, 4 + mediaRows.length)}`).format.columnWidth = 34;
mediaSheet.getRange("L1:L20").format.columnWidth = 24;
mediaSheet.getRange("M1:M20").format.columnWidth = 18;
errorSheet.getRange(`B1:F${Math.max(5, 4 + failureRows.length)}`).format.columnWidth = 28;
ledgerSheet.getRange(`C1:G${Math.max(5, 4 + ledgerRows.length)}`).format.columnWidth = 30;
qualitySheet.getRange(`D1:E${Math.max(5, 4 + qualityRows.length)}`).format.columnWidth = 36;
raw.getRange(`E1:F${Math.max(5, 4 + normalizedRows.length)}`).format.columnWidth = 34;
raw.getRange(`R1:S${Math.max(5, 4 + normalizedRows.length)}`).format.columnWidth = 30;

const dashboardInspect = await wb.inspect({
  kind: "table",
  range: "経営ダッシュボード!A1:L45",
  include: "values,formulas",
  tableMaxRows: 45,
  tableMaxCols: 12,
});
const formulaErrors = await wb.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});

const renders = [];
const renderRanges = {
  "経営ダッシュボード": "A1:L50",
  "週次推移": "A1:O12",
  "流入源": "A1:H30",
  "検索機会": "A1:I30",
  "重賞記事": "A1:X30",
  "広告収益": "A1:L30",
  "YouTube・SNS": "A1:M30",
  "障害": "A1:I30",
  "ファネル": "A1:D30",
  "改善台帳": "A1:I30",
  "取得品質": "A1:E20",
  "原本": "A1:S25",
};
for (const name of sheetNames) {
  const renderOptions = {
    sheetName: name,
    range: renderRanges[name],
    scale: 1,
    format: "png",
  };
  const preview = await wb.render(renderOptions);
  const bytes = new Uint8Array(await preview.arrayBuffer());
  const renderPath = path.join(renderDir, `${name}.png`);
  await fs.writeFile(renderPath, bytes);
  renders.push({ sheet: name, path: renderPath, bytes: bytes.length });
}

const exported = await SpreadsheetFile.exportXlsx(wb);
await exported.save(outputPath);
await fs.writeFile(validationPath, JSON.stringify({
  generated_at: new Date().toISOString(),
  workbook: outputPath,
  formal_week: Boolean(formal.formal),
  sheet_names: sheetNames,
  history_row_count: (history.rows || []).length,
  normalized_row_count: normalizedRows.length,
  raw_rows_per_dataset: rawRowsPerDataset,
  dashboard_inspection: dashboardInspect,
  formula_error_inspection: formulaErrors,
  renders,
}, null, 2), "utf8");

console.log(JSON.stringify({ output: outputPath, validation: validationPath, sheets: sheetNames.length }));

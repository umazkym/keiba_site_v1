import os
import json
import sqlite3
import glob
import re
import pandas as pd
from datetime import datetime, timedelta

# 分析の定数
ANALYSIS_YEARS = 3
MIN_WIN_RATE_RATIO = 1.2  # 閾値を下げて検証
JRA_VENUES = [
    '札幌', '函館', '福島', '新潟', '東京', '中山',
    '中京', '京都', '阪神', '小倉'
]

# 施策B: 競馬場別の検索需要重み（Google検索ボリュームに基づく推定値）
# Phase 6でGSCデータ導入後に自動更新する設計に移行可能
SEARCH_DEMAND_WEIGHT = {
    '中山': 1.4, '東京': 1.4, '阪神': 1.3, '京都': 1.3,
    '中京': 1.1, '新潟': 1.0, '小倉': 0.9, '函館': 0.85,
    '福島': 0.9, '札幌': 0.85
}

VENUE_SLUGS = {
    '札幌': 'sapporo',
    '函館': 'hakodate',
    '福島': 'fukushima',
    '新潟': 'niigata',
    '東京': 'tokyo',
    '中山': 'nakayama',
    '中京': 'chukyo',
    '京都': 'kyoto',
    '阪神': 'hanshin',
    '小倉': 'kokura',
}

COURSE_PROFILE_PATHS = {
    ('nakayama', 'dirt-1200m'),
    ('tokyo', 'turf-2000m'),
    ('tokyo', 'turf-2400m'),
    ('kyoto', 'turf-1800m'),
    ('niigata', 'turf-1000m'),
    ('hanshin', 'dirt-1400m'),
    ('sapporo', 'turf-2000m'),
    ('tokyo', 'dirt-1600m'),
    ('tokyo', 'turf-1600m'),
    ('nakayama', 'dirt-1800m'),
    ('nakayama', 'turf-1200m'),
    ('chukyo', 'turf-2000m'),
    ('chukyo', 'dirt-1200m'),
    ('fukushima', 'turf-1800m'),
    ('hanshin', 'turf-1600m'),
    ('kyoto', 'dirt-1800m'),
    ('kokura', 'turf-1200m'),
    ('hakodate', 'turf-1200m'),
    ('nakayama', 'turf-2500m'),
}

# 施策A: 開催カレンダー（各競馬場の主要開催月）
VENUE_SEASONS = {
    '札幌': [6, 7, 8, 9], '函館': [6, 7, 8],
    '福島': [4, 7, 11], '新潟': [5, 8, 10],
    '東京': [2, 5, 6, 10, 11], '中山': [1, 3, 4, 9, 12],
    '中京': [1, 3, 7, 12], '京都': [1, 2, 5, 10, 11],
    '阪神': [3, 4, 6, 9, 12], '小倉': [2, 7, 8]
}

# パス設定
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) # backend/
DB_PATH = os.path.join(BASE_DIR, 'keiba.db')
PROJECT_ROOT = os.path.dirname(BASE_DIR)
POSTED_HISTORY_PATH = os.path.join(PROJECT_ROOT, 'data', 'posted_history.json')
WRITE_ORDERS_DIR = os.path.join(PROJECT_ROOT, 'data', 'write_orders')
ARTICLES_DIR = os.path.join(PROJECT_ROOT, 'frontend', 'content', 'articles')

def load_posted_keywords():
    """公開済み投稿履歴を読み込み、キーワードのSetを返す"""
    if os.path.exists(POSTED_HISTORY_PATH):
        with open(POSTED_HISTORY_PATH, 'r', encoding='utf-8') as f:
            try:
                history = json.load(f)
                return {
                    item.get('target_keyword')
                    for item in history
                    if item.get('target_keyword') and (
                        item.get('draft') is False
                        or bool(item.get('slug'))
                        or bool(item.get('published_at'))
                    )
                }
            except json.JSONDecodeError:
                return set()
    return set()

def load_existing_article_keywords():
    """既存の記事ファイルのfrontmatterからtarget_keywordを収集する"""
    keywords = set()
    if not os.path.exists(ARTICLES_DIR):
        return keywords
    
    for filepath in glob.glob(os.path.join(ARTICLES_DIR, '*.md')):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            # 簡易的なfrontmatter解析（gray-matterの代替）
            if content.startswith('---'):
                parts = content.split('---', 2)
                if len(parts) >= 3:
                    frontmatter = parts[1]
                    for line in frontmatter.split('\n'):
                        if line.strip().startswith('target_keyword:'):
                            kw = line.split(':', 1)[1].strip().strip('"').strip("'")
                            if kw:
                                keywords.add(kw)
                            break
        except Exception:
            continue
    
    return keywords

def load_pending_order_keywords():
    """未消費のwrite_orderのtarget_keywordを収集する"""
    keywords = set()
    if not os.path.exists(WRITE_ORDERS_DIR):
        return keywords
    
    for filepath in glob.glob(os.path.join(WRITE_ORDERS_DIR, '*.json')):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                order = json.load(f)
                kw = order.get('target_keyword')
                if kw:
                    keywords.add(kw)
        except Exception:
            continue
    
    return keywords

def course_entity_from_condition(condition: str):
    """コース条件名から内部資産IDと既存コースページへのcanonicalを組み立てる"""
    for venue_name, venue_slug in VENUE_SLUGS.items():
        if not condition.startswith(venue_name):
            continue

        rest = condition[len(venue_name):]
        match = re.search(r'(芝|ダート|ダ)(\d{3,4})m', rest)
        if not match:
            return {
                "entity_key": "",
                "canonical_path": "",
            }

        course_kind = 'dirt' if match.group(1) in {'ダート', 'ダ'} else 'turf'
        course_slug = f"{course_kind}-{match.group(2)}m"
        entity_key = f"{venue_slug}-{course_slug}"
        canonical_path = (
            f"/courses/{venue_slug}/{course_slug}"
            if (venue_slug, course_slug) in COURSE_PROFILE_PATHS
            else ""
        )
        return {
            "entity_key": entity_key,
            "canonical_path": canonical_path,
        }

    return {
        "entity_key": "",
        "canonical_path": "",
    }

def get_waku_number(horse_number, total_horses):
    """馬番と出走頭数から公式枠番を計算する"""
    if total_horses <= 8:
        return horse_number
    
    q = total_horses // 8
    r = total_horses % 8
    
    waku_counts = []
    for waku_idx in range(8):
        if (7 - waku_idx) < r:
            waku_counts.append(q + 1)
        else:
            waku_counts.append(q)
            
    current_horse = 1
    for waku_idx in range(8):
        count = waku_counts[waku_idx]
        if current_horse <= horse_number < current_horse + count:
            return waku_idx + 1
        current_horse += count
        
    return None

def fetch_data():
    """
    keiba.db からレース結果・払戻金データを結合して取得する。
    仕様書精査に基づく修正点:
    1. 回収率用: race_returns の bet_type='単勝' と number_1(馬番) で結合。
    2. コース判定: races.course_type が '芝' または 'ダート' に限定。
    """
    db_url = os.environ.get('DATABASE_URL')
    cutoff_date = (datetime.now() - timedelta(days=365 * ANALYSIS_YEARS)).strftime('%Y-%m-%d')

    # waku_number が NULL になっている2025年以降のデータを含めて集計するため、
    # SQL側では waku_number BETWEEN 1 AND 8 フィルタを外します（後ほどPython側で復元）。
    # 代わりに、単勝払戻データが存在するレースのみに集計対象を限定（EXISTS句）します。
    query = f"""
    SELECT 
        r.id AS race_id, 
        r.venue_name, 
        r.course_type, 
        r.distance,
        r.race_date,
        res.waku_number,
        res.horse_number,
        res.rank,
        res.popularity,
        res.corner_positions,
        j.name AS jockey_name,
        ret.payout AS win_payout
    FROM races r
    JOIN results res ON r.id = res.race_id
    LEFT JOIN jockeys j ON res.jockey_id = j.id
    LEFT JOIN race_returns ret 
        ON r.id = ret.race_id 
        AND ret.bet_type = 'tansho' 
        AND ret.number_1 = res.horse_number
    WHERE r.course_type IN ('芝', 'ダ')
      AND r.race_date >= '{cutoff_date}'
      AND r.distance IS NOT NULL
      AND res.rank IS NOT NULL
      AND EXISTS (
          SELECT 1 FROM race_returns ret_sub 
          WHERE ret_sub.race_id = r.id 
            AND ret_sub.bet_type = 'tansho'
      )
    """

    if db_url:
        import sqlalchemy
        engine = sqlalchemy.create_engine(db_url)
        df = pd.read_sql_query(query, engine)
        engine.dispose()
    else:
        if not os.path.exists(DB_PATH):
            raise FileNotFoundError(f"Database not found at {DB_PATH}")
        conn = sqlite3.connect(DB_PATH)
        df = pd.read_sql_query(query, conn)
        conn.close()
    
    # データ型のクレンジング
    df['race_date'] = pd.to_datetime(df['race_date'])
    df['rank'] = pd.to_numeric(df['rank'], errors='coerce')
    df['win_payout'] = df['win_payout'].fillna(0) # 払戻金がない（未勝利等）は0

    # 枠番ハイブリッド復元（2025年以降のNULL欠損を補完）
    if not df.empty:
        # レースごとの本来の出走頭数 = 馬番の最大値を算出（除外馬対応）
        race_max_horse = df.groupby('race_id')['horse_number'].transform('max')
        df['total_horses'] = race_max_horse
        
        def restore_waku(row):
            db_waku = row['waku_number']
            if pd.notna(db_waku) and 1 <= db_waku <= 8:
                return int(db_waku)
            return get_waku_number(row['horse_number'], row['total_horses'])
            
        df['waku_number'] = df.apply(restore_waku, axis=1)

    return df

def analyze_waku_bias(df):
    """
    枠順の有利不利（特異点）を計算する。
    """
    df = df.copy()
    # 検索需要の高いコース名を作成（例：中山ダート1200m）
    display_course = df['course_type'].replace({'ダ': 'ダート'})
    df['condition'] = df['venue_name'] + display_course + df['distance'].astype(str) + 'm'
    
    # コース×枠番ごとに集計
    waku_stats = df.groupby(['condition', 'waku_number']).agg(
        total_runs=('horse_number', 'count'),
        wins=('rank', lambda x: (x == 1).sum()),
        places=('rank', lambda x: (x <= 3).sum()),
        total_win_payout=('win_payout', 'sum')
    ).reset_index()
    
    # 各種レート計算
    waku_stats['win_rate'] = waku_stats['wins'] / waku_stats['total_runs']
    waku_stats['place_rate'] = waku_stats['places'] / waku_stats['total_runs']
    # 100円購入時の回収率
    waku_stats['roi'] = waku_stats['total_win_payout'] / (waku_stats['total_runs'] * 100) 
    
    # ノイズ排除：全ての枠で最低出走数が50頭以上のコースのみ抽出
    cond_stats = waku_stats.groupby('condition').agg(
        min_runs=('total_runs', 'min'),
        max_runs=('total_runs', 'max'),
        total_sample=('total_runs', 'sum'),
        win_rate_std=('win_rate', 'std'), # 勝率のバラツキ（特異度スコア）
        roi_std=('roi', 'std')            # 回収率のバラツキ
    ).reset_index()
    
    valid_conds = cond_stats[cond_stats['min_runs'] >= 50].copy()

    # 勝率比率によるフィルタリング
    def _calc_win_rate_ratio(cond, ws):
        rates = ws[ws['condition'] == cond]['win_rate']
        max_r, min_r = rates.max(), rates.min()
        if min_r == 0:
            return float('inf') # 0除算防止
        return max_r / min_r

    # 回収率の欠損チェック（全枠平均が5%未満のコースは除外）
    def _has_valid_roi(cond, ws):
        roi_vals = ws[ws['condition'] == cond]['roi']
        return roi_vals.mean() >= 0.05

    valid_conds['win_rate_ratio'] = valid_conds['condition'].apply(lambda c: _calc_win_rate_ratio(c, waku_stats))
    valid_conds['has_valid_roi'] = valid_conds['condition'].apply(lambda c: _has_valid_roi(c, waku_stats))
    
    # JRAの主要10場のみに絞る（検索需要担保のため）
    valid_conds['is_jra'] = valid_conds['condition'].apply(lambda c: any(v in c for v in JRA_VENUES))

    print(f"[Debug] conds >= 50 runs: {len(valid_conds)}")
    print(f"[Debug] is_jra: {valid_conds['is_jra'].sum()}")
    print(f"[Debug] has_valid_roi (>5%): {valid_conds['has_valid_roi'].sum()}")
    print(f"[Debug] ratio >= {MIN_WIN_RATE_RATIO}: {(valid_conds['win_rate_ratio'] >= MIN_WIN_RATE_RATIO).sum()}")

    valid_conds = valid_conds[
        (valid_conds['win_rate_ratio'] >= MIN_WIN_RATE_RATIO) & 
        (valid_conds['has_valid_roi']) &
        (valid_conds['is_jra'])
    ].copy()

    print(f"[Debug] Final valid matching ALL criteria: {len(valid_conds)}")
    
    # 施策B: 検索需要重みを取得するヘルパー
    def _get_venue_weight(cond):
        for venue, weight in SEARCH_DEMAND_WEIGHT.items():
            if venue in cond:
                return weight
        return 1.0

    # 特異点スコアの算出：統計的偏差 × 検索需要重み
    valid_conds['search_weight'] = valid_conds['condition'].apply(_get_venue_weight)
    valid_conds['anomaly_score'] = (
        (valid_conds['win_rate_std'] * 100) + (valid_conds['roi_std'] * 10)
    ) * valid_conds['search_weight']
    
    # スコアで降順ソート
    ranked_conds = valid_conds.sort_values('anomaly_score', ascending=False)
    
    return ranked_conds, waku_stats, df

def analyze_jockey_bias(df):
    """騎手の有利不利を計算。勝率や回収率が高い騎手を抽出"""
    df = df.copy()
    display_course = df['course_type'].replace({'ダ': 'ダート'})
    df['condition'] = df['venue_name'] + display_course + df['distance'].astype(str) + 'm'
    
    # jockey_nameがnullの行は落とす
    df_jockey = df.dropna(subset=['jockey_name'])
    
    jockey_stats = df_jockey.groupby(['condition', 'jockey_name']).agg(
        total_runs=('horse_number', 'count'),
        wins=('rank', lambda x: (x == 1).sum()),
        places=('rank', lambda x: (x <= 3).sum()),
        total_win_payout=('win_payout', 'sum')
    ).reset_index()
    
    # 統計的信頼性を確保するため、騎乗回数30回以上に絞る
    jockey_stats = jockey_stats[jockey_stats['total_runs'] >= 30].copy()
    
    jockey_stats['win_rate'] = jockey_stats['wins'] / jockey_stats['total_runs']
    jockey_stats['place_rate'] = jockey_stats['places'] / jockey_stats['total_runs']
    jockey_stats['roi'] = jockey_stats['total_win_payout'] / (jockey_stats['total_runs'] * 100)
    
    cond_stats = jockey_stats.groupby('condition').agg(
        num_jockeys=('jockey_name', 'count'),
        max_win_rate=('win_rate', 'max')
    ).reset_index()
    
    # 有効な騎手が複数いて、最高勝率が15%以上のコースを採用
    valid_conds = cond_stats[(cond_stats['num_jockeys'] >= 3) & (cond_stats['max_win_rate'] >= 0.15)].copy()
    valid_conds['is_jra'] = valid_conds['condition'].apply(lambda c: any(v in c for v in JRA_VENUES))
    valid_conds = valid_conds[valid_conds['is_jra']].copy()
    
    def _get_venue_weight(cond):
        for venue, weight in SEARCH_DEMAND_WEIGHT.items():
            if venue in cond: return weight
        return 1.0
    
    valid_conds['search_weight'] = valid_conds['condition'].apply(_get_venue_weight)
    valid_conds['anomaly_score'] = (valid_conds['max_win_rate'] * 100) * valid_conds['search_weight']
    
    ranked_conds = valid_conds.sort_values('anomaly_score', ascending=False)
    return ranked_conds, jockey_stats, df

def analyze_popularity_bias(df):
    """上位人気（1〜3番人気）の勝率や信頼度（荒れやすさ）を計算"""
    df = df.copy()
    display_course = df['course_type'].replace({'ダ': 'ダート'})
    df['condition'] = df['venue_name'] + display_course + df['distance'].astype(str) + 'm'
    
    df_pop = df.dropna(subset=['popularity'])
    
    pop_stats = df_pop.groupby(['condition', 'popularity']).agg(
        total_runs=('horse_number', 'count'),
        wins=('rank', lambda x: (x == 1).sum()),
        places=('rank', lambda x: (x <= 3).sum()),
        total_win_payout=('win_payout', 'sum')
    ).reset_index()
    
    pop_stats['win_rate'] = pop_stats['wins'] / pop_stats['total_runs']
    pop_stats['place_rate'] = pop_stats['places'] / pop_stats['total_runs']
    pop_stats['roi'] = pop_stats['total_win_payout'] / (pop_stats['total_runs'] * 100)
    
    # コースごとの1番人気の勝率をスコアに使用
    pop1 = pop_stats[pop_stats['popularity'] == 1].copy()
    pop1 = pop1[pop1['total_runs'] >= 50] # 1番人気の母数が50以上を対象
    
    pop1['is_jra'] = pop1['condition'].apply(lambda c: any(v in c for v in JRA_VENUES))
    valid_conds = pop1[pop1['is_jra']].copy()
    
    def _get_venue_weight(cond):
        for venue, weight in SEARCH_DEMAND_WEIGHT.items():
            if venue in cond: return weight
        return 1.0
    
    valid_conds['search_weight'] = valid_conds['condition'].apply(_get_venue_weight)
    
    # 荒れる（1番人気の勝率が低い）コース、あるいは極端に堅い（勝率が高い）コースをスコア化
    # 30%を中央値とし、そこからの差分を絶対値でスコア化
    valid_conds['anomaly_score'] = abs(valid_conds['win_rate'] - 0.3) * 100 * valid_conds['search_weight']
    
    ranked_conds = valid_conds.sort_values('anomaly_score', ascending=False)
    return ranked_conds, pop_stats, df

def analyze_running_style_bias(df):
    """コーナー順位データ（corner_positions）を用いて脚質の有利不利を推定"""
    df = df.copy()
    display_course = df['course_type'].replace({'ダ': 'ダート'})
    df['condition'] = df['venue_name'] + display_course + df['distance'].astype(str) + 'm'
    
    df_rp = df.dropna(subset=['corner_positions']).copy()
    
    def extract_4c_position(corner_json):
        try:
            if not corner_json: return None
            data = json.loads(corner_json) if isinstance(corner_json, str) else corner_json
            if isinstance(data, list) and len(data) > 0:
                # 最後のコーナー（4角等）の順位を取得
                # "2-3-4-5" のような文字列か、数値が入る可能性がある。ここではシンプルに数値抽出を試みる
                # （※データベースの実態に依存するが、数値リストである前提）
                last_c = data[-1]
                if isinstance(last_c, int):
                    return last_c
                elif isinstance(last_c, str) and last_c.isdigit():
                    return int(last_c)
            return None
        except:
            return None
            
    df_rp['pos_4c'] = df_rp['corner_positions'].apply(extract_4c_position)
    df_rp = df_rp.dropna(subset=['pos_4c'])
    
    # 簡易脚質分類（おおよその傾向）
    df_rp['running_style'] = df_rp['pos_4c'].apply(lambda x: '逃げ・先行' if x <= 4 else '差し・追込')
    
    style_stats = df_rp.groupby(['condition', 'running_style']).agg(
        total_runs=('horse_number', 'count'),
        wins=('rank', lambda x: (x == 1).sum()),
        places=('rank', lambda x: (x <= 3).sum()),
    ).reset_index()
    
    style_stats = style_stats[style_stats['total_runs'] >= 50].copy()
    style_stats['win_rate'] = style_stats['wins'] / style_stats['total_runs']
    style_stats['place_rate'] = style_stats['places'] / style_stats['total_runs']
    
    # 先行と差しの勝率差を使ってスコア化
    cond_stats = style_stats.groupby('condition').agg(
        num_styles=('running_style', 'count'),
        max_win_rate=('win_rate', 'max'),
        min_win_rate=('win_rate', 'min'),
        total_runs=('total_runs', 'sum')
    ).reset_index()
    
    valid_conds = cond_stats[(cond_stats['num_styles'] >= 2) & (cond_stats['total_runs'] >= 100)].copy()
    valid_conds['is_jra'] = valid_conds['condition'].apply(lambda c: any(v in c for v in JRA_VENUES))
    valid_conds = valid_conds[valid_conds['is_jra']].copy()
    
    def _get_venue_weight(cond):
        for venue, weight in SEARCH_DEMAND_WEIGHT.items():
            if venue in cond: return weight
        return 1.0
        
    valid_conds['search_weight'] = valid_conds['condition'].apply(_get_venue_weight)
    valid_conds['anomaly_score'] = ((valid_conds['max_win_rate'] - valid_conds['min_win_rate']) * 100) * valid_conds['search_weight']
    
    ranked_conds = valid_conds.sort_values('anomaly_score', ascending=False)
    return ranked_conds, style_stats, df

def determine_theme_cluster(condition: str) -> str:
    """施策A: コースの開催時期と現在月からテーマクラスターを自動判定"""
    current_month = datetime.now().month
    for venue, months in VENUE_SEASONS.items():
        if venue in condition and current_month in months:
            return "seasonal"
    return "asset"

def generate_write_order():
    """特異点データから write_order.json を生成するメイン処理"""
    print("[DataScientist] Starting extraction process...")
    
    # 3層の重複チェック
    posted_keywords = load_posted_keywords()
    existing_keywords = load_existing_article_keywords()
    pending_keywords = load_pending_order_keywords()
    
    # 全ての既知キーワードを統合
    all_known_keywords = posted_keywords | existing_keywords | pending_keywords
    print(f"[DataScientist] 重複チェック対象: posted_history={len(posted_keywords)}, 既存記事={len(existing_keywords)}, 未消費order={len(pending_keywords)}, 合計={len(all_known_keywords)}")
    
    # Search Consoleでは「騎手名 + 得意コース」「競馬データ分析 無料」の表示が伸びているため、
    # ランダム選定ではなく、検索流入に直結しやすいテーマから順に探索する。
    themes = ['jockey', 'popularity', 'waku', 'running_style']
    
    df = fetch_data()
    if df.empty:
        print("[DataScientist Error] No valid data extracted from DB.")
        return
        
    for selected_theme in themes:
        print(f"[DataScientist] Trying Theme: {selected_theme}")

        if selected_theme == 'waku':
            ranked_conds, stats_df, df = analyze_waku_bias(df)
            theme_id = "waku_data"
            keyword_suffix = "枠順 データ"
            comp_struct = [
                "コース概要と特徴",
                "枠順別データと明確な有利不利",
                "オッズ（回収率）から見る狙い目"
            ]
        elif selected_theme == 'jockey':
            ranked_conds, stats_df, df = analyze_jockey_bias(df)
            theme_id = "jockey_data"
            keyword_suffix = "騎手 データ"
            comp_struct = [
                "コース概要と基本情報",
                "勝率と複勝率で見る騎手ランキング",
                "回収率と人気のズレで残したい騎手"
            ]
        elif selected_theme == 'popularity':
            ranked_conds, stats_df, df = analyze_popularity_bias(df)
            theme_id = "popularity_data"
            keyword_suffix = "荒れる 傾向"
            comp_struct = [
                "コース概要と基本情報",
                "一番人気の信頼度と勝率データ",
                "配当傾向から見る穴馬の狙い目"
            ]
        else:  # running_style
            ranked_conds, stats_df, df = analyze_running_style_bias(df)
            theme_id = "running_style_data"
            keyword_suffix = "脚質 有利"
            comp_struct = [
                "コース概要と直線距離の特徴",
                "逃げ・先行馬の勝率と地の利",
                "差し・追込馬の台頭条件"
            ]

        for _, row in ranked_conds.iterrows():
            condition = row['condition']
            target_keyword = f"{condition} {keyword_suffix}"

            if target_keyword in all_known_keywords:
                continue

            print(f"[DataScientist] Anomaly found! Target: {target_keyword} (Score: {row['anomaly_score']:.2f})")

            period_min = df['race_date'].min().strftime('%Y年%m月')
            period_max = df['race_date'].max().strftime('%Y年%m月')
            season_year = int(df['race_date'].max().year)
            course_entity = course_entity_from_condition(condition)
            entity_key = course_entity["entity_key"]
            entity_path = course_entity["canonical_path"]
            canonical_path = ""
            content_target = "course_hub_support" if entity_path else "course_data_article"
            max_runs_val = 0
            key_metrics = []

            if selected_theme == 'waku':
                metrics_df = stats_df[stats_df['condition'] == condition].sort_values('waku_number')
                max_runs_val = int(metrics_df['total_runs'].max() if not metrics_df.empty else 0)
                for _, m_row in metrics_df.iterrows():
                    key_metrics.append({
                        "枠番": f"{int(m_row['waku_number'])}枠",
                        "勝率": f"{m_row['win_rate']*100:.1f}%",
                        "複勝率": f"{m_row['place_rate']*100:.1f}%",
                        "単勝回収率": f"{m_row['roi']*100:.0f}%"
                    })
            elif selected_theme == 'jockey':
                metrics_df = stats_df[stats_df['condition'] == condition].sort_values('win_rate', ascending=False).head(5)
                max_runs_val = int(metrics_df['total_runs'].max() if not metrics_df.empty else 0)
                for _, m_row in metrics_df.iterrows():
                    key_metrics.append({
                        "騎手": m_row['jockey_name'],
                        "騎乗回数": int(m_row['total_runs']),
                        "勝率": f"{m_row['win_rate']*100:.1f}%",
                        "単勝回収率": f"{m_row['roi']*100:.0f}%"
                    })
            elif selected_theme == 'popularity':
                metrics_df = stats_df[stats_df['condition'] == condition].sort_values('popularity').head(5)
                max_runs_val = int(metrics_df['total_runs'].max() if not metrics_df.empty else 0)
                for _, m_row in metrics_df.iterrows():
                    key_metrics.append({
                        "人気": f"{int(m_row['popularity'])}番人気",
                        "勝率": f"{m_row['win_rate']*100:.1f}%",
                        "複勝率": f"{m_row['place_rate']*100:.1f}%",
                        "単勝回収率": f"{m_row['roi']*100:.0f}%"
                    })
            else:  # running_style
                metrics_df = stats_df[stats_df['condition'] == condition].sort_values('win_rate', ascending=False)
                max_runs_val = int(metrics_df['total_runs'].max() if not metrics_df.empty else 0)
                for _, m_row in metrics_df.iterrows():
                    key_metrics.append({
                        "脚質": m_row['running_style'],
                        "該当数": int(m_row['total_runs']),
                        "勝率": f"{m_row['win_rate']*100:.1f}%",
                        "複勝率": f"{m_row['place_rate']*100:.1f}%"
                    })

            # WriteOrder スキーマへのマッピング
            order = {
                "target_keyword": target_keyword,
                "theme_cluster": theme_id,
                "entity_type": "course" if entity_key else "",
                "entity_key": entity_key,
                "season_year": season_year if entity_key else "",
                "entity_path": entity_path,
                "canonical_path": canonical_path,
                "content_target": content_target,
                "priority": 10,
                "reference_data": {
                    "entity_type": "course" if entity_key else "",
                    "entity_key": entity_key,
                    "season_year": season_year if entity_key else "",
                    "entity_path": entity_path,
                    "canonical_path": canonical_path,
                    "content_target": content_target,
                    "period": f"{period_min}〜{period_max}",
                    "condition": f"{condition} 良〜不良",
                    "sample_size": max_runs_val,
                    "key_metrics": key_metrics,
                    "source": "独自集計データ"
                },
                "competing_article_structure": comp_struct
            }

            os.makedirs(WRITE_ORDERS_DIR, exist_ok=True)
            date_str = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_path = os.path.join(WRITE_ORDERS_DIR, f"{date_str}.json")

            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(order, f, ensure_ascii=False, indent=2)

            print(f"[DataScientist] Successfully generated WriteOrder: {output_path}")
            return  # 生成に成功したら即終了（1回につき1記事）

    print("[DataScientist] No new valid conditions found across all themes.")

if __name__ == '__main__':
    generate_write_order()

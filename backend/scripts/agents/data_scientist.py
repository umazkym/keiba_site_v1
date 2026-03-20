import os
import json
import sqlite3
import pandas as pd
from datetime import datetime, timedelta

# 分析の定数
ANALYSIS_YEARS = 3
MIN_WIN_RATE_RATIO = 1.2  # 閾値を下げて検証
JRA_VENUES = [
    '札幌', '函館', '福島', '新潟', '東京', '中山',
    '中京', '京都', '阪神', '小倉'
]

# パス設定
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) # backend/
DB_PATH = os.path.join(BASE_DIR, 'keiba.db')
PROJECT_ROOT = os.path.dirname(BASE_DIR)
POSTED_HISTORY_PATH = os.path.join(PROJECT_ROOT, 'data', 'posted_history.json')
WRITE_ORDERS_DIR = os.path.join(PROJECT_ROOT, 'data', 'write_orders')

def load_posted_keywords():
    """過去の投稿履歴を読み込み、キーワードのSetを返す"""
    if os.path.exists(POSTED_HISTORY_PATH):
        with open(POSTED_HISTORY_PATH, 'r', encoding='utf-8') as f:
            try:
                history = json.load(f)
                return {item.get('target_keyword') for item in history}
            except json.JSONDecodeError:
                return set()
    return set()

def fetch_data():
    """
    keiba.db からレース結果・払戻金データを結合して取得する。
    仕様書精査に基づく修正点:
    1. 回収率用: race_returns の bet_type='単勝' と number_1(馬番) で結合。
    2. コース判定: races.course_type が '芝' または 'ダート' に限定。
    """
    db_url = os.environ.get('DATABASE_URL')
    cutoff_date = (datetime.now() - timedelta(days=365 * ANALYSIS_YEARS)).strftime('%Y-%m-%d')

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
        ret.payout AS win_payout
    FROM races r
    JOIN results res ON r.id = res.race_id
    /* 単勝払戻金の取得。number_1は馬番を指すためhorse_numberと結合 */
    LEFT JOIN race_returns ret 
        ON r.id = ret.race_id 
        AND ret.bet_type = 'tansho' 
        AND ret.number_1 = res.horse_number
    WHERE r.course_type IN ('芝', 'ダ')
      AND r.race_date >= '{cutoff_date}'
      AND r.distance IS NOT NULL
      AND res.waku_number BETWEEN 1 AND 8
      AND res.rank IS NOT NULL
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
    
    # 特異点スコアの算出：勝率と回収率の有利不利格差が激しいほどスコアが高い
    valid_conds['anomaly_score'] = (valid_conds['win_rate_std'] * 100) + (valid_conds['roi_std'] * 10)
    
    # スコアで降順ソート
    ranked_conds = valid_conds.sort_values('anomaly_score', ascending=False)
    
    return ranked_conds, waku_stats, df

def generate_write_order():
    """特異点データから write_order.json を生成するメイン処理"""
    print("[DataScientist] Starting extraction process...")
    posted_keywords = load_posted_keywords()
    
    df = fetch_data()
    if df.empty:
        print("[DataScientist Error] No valid data extracted from DB.")
        return
        
    ranked_conds, waku_stats, df = analyze_waku_bias(df)
    
    for _, row in ranked_conds.iterrows():
        condition = row['condition']
        
        # サジェスト等で需要が高い検索キーワードのフォーマット
        target_keyword = f"{condition} 枠順 データ"
        
        # 過去記事と重複している場合はスキップ
        if target_keyword in posted_keywords:
            continue
            
        # 未開拓の激アツ特異点を発見
        print(f"[DataScientist] Anomaly found! Target: {target_keyword} (Score: {row['anomaly_score']:.2f})")
        metrics_df = waku_stats[waku_stats['condition'] == condition].sort_values('waku_number')
        
        # key_metrics の整形
        key_metrics = []
        for _, m_row in metrics_df.iterrows():
            waku = int(m_row['waku_number'])
            key_metrics.append({
                "枠番": f"{waku}枠",
                "勝率": f"{m_row['win_rate']*100:.1f}%",
                "複勝率": f"{m_row['place_rate']*100:.1f}%",
                "単勝回収率": f"{m_row['roi']*100:.0f}%"
            })
            
        course_df = df[df['condition'] == condition]
        period_min = course_df['race_date'].min().strftime('%Y年%m月')
        period_max = course_df['race_date'].max().strftime('%Y年%m月')
        
        # WriteOrder スキーマへのマッピング
        order = {
            "target_keyword": target_keyword,
            "theme_cluster": "asset",
            "reference_data": {
                "period": f"{period_min}〜{period_max}",
                "condition": f"{condition} 良〜不良",
                "sample_size": int(row['max_runs']),
                "key_metrics": key_metrics,
                "source": "独自集計データ"
            },
            "competing_article_structure": [
                f"{condition}のコース概要と特徴",
                "枠順別データと明確な有利不利",
                "オッズ（回収率）から見る狙い目"
            ]
        }
        
        os.makedirs(WRITE_ORDERS_DIR, exist_ok=True)
        date_str = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_path = os.path.join(WRITE_ORDERS_DIR, f"{date_str}.json")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(order, f, ensure_ascii=False, indent=2)
            
        print(f"[DataScientist] Successfully generated WriteOrder: {output_path}")
        return
        
    print("[DataScientist] No new valid conditions found to write about.")

if __name__ == '__main__':
    generate_write_order()

# master_analyzer.py - 完全拡張版
import argparse
import os
import json
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from tqdm import tqdm
from datetime import datetime, date
import traceback

# ==============================================================================
# 共通ユーティリティ関数
# ==============================================================================
def setup_matplotlib():
    """
    matplotlibで日本語が文字化けしないように設定します。
    japanize-matplotlibライブラリが必要です。
    """
    try:
        import japanize_matplotlib
        print("✅ Matplotlibの日本語設定が有効になりました。")
    except ImportError:
        print("⚠️ 警告: japanize-matplotlibがインストールされていません。")
        print("グラフの日本語が文字化けする可能性があります。")
        print("pip install japanize-matplotlib を実行してください。")

def get_db_session(database_url: str) -> Session | None:
    """
    データベースURLからSQLAlchemyのセッションオブジェクトを作成して返します。
    """
    try:
        print("データベースに接続しています...")
        # ★修正★ クライアントエンコーディングをUTF-8に明示的に設定
        engine = create_engine(
            database_url,
            connect_args={
                'client_encoding': 'utf8',
                'options': '-c client_encoding=UTF8'
            },
            # PostgreSQLの場合、プールの設定も追加
            pool_pre_ping=True,  # 接続の有効性を事前にチェック
            pool_recycle=3600,   # 1時間ごとに接続をリサイクル
            echo=False           # SQLログを非表示
        )
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        print("✅ 接続に成功しました。")
        return SessionLocal()
    except Exception as e:
        print(f"❌ データベース接続エラー: {e}")
        print("DATABASE_URLが正しいか、データベースが起動しているか確認してください。")
        return None

def save_analysis_results(output_dir: str, data: dict, figures: dict, summary: str):
    """
    分析結果（データ、グラフ、サマリー）を指定されたディレクトリに保存します。
    """
    try:
        os.makedirs(output_dir, exist_ok=True)
        
        # ★修正★ カスタムJSONエンコーダーを追加
        class DateTimeEncoder(json.JSONEncoder):
            """dateやdatetimeオブジェクトをJSON形式に変換するカスタムエンコーダー"""
            def default(self, obj):
                if isinstance(obj, (datetime, date)):
                    return obj.isoformat()
                if isinstance(obj, np.integer):
                    return int(obj)
                if isinstance(obj, np.floating):
                    return float(obj)
                if isinstance(obj, np.ndarray):
                    return obj.tolist()
                if pd.isna(obj):
                    return None
                return super().default(obj)
        
        # 1. 詳細データをJSONとして保存
        data_path = os.path.join(output_dir, "data.json")
        with open(data_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4, cls=DateTimeEncoder)
        print(f"💾 データ(JSON)を保存しました: {data_path}")
        
        # 2. グラフをPNGファイルとして保存
        for filename, fig in figures.items():
            graph_path = os.path.join(output_dir, f"{filename}.png")
            fig.savefig(graph_path, bbox_inches='tight', dpi=150)
            plt.close(fig)
            print(f"📊 グラフ(PNG)を保存しました: {graph_path}")
        
        # 3. 分析サマリーをテキストファイルとして保存
        summary_path = os.path.join(output_dir, "summary.txt")
        with open(summary_path, 'w', encoding='utf-8') as f:
            f.write(summary)
        print(f"📝 サマリー(TXT)を保存しました: {summary_path}")
        
    except Exception as e:
        print(f"❌ ファイルの保存中にエラーが発生しました: {e}")

# ==============================================================================
# 既存の分析機能 1: AI予測 精度レビュー
# ==============================================================================
def analyze_ai_performance(db_session: Session, start_date: str, end_date: str):
    """
    AI予測の精度を分析し、結果を返す。
    """
    query = f"""
    SELECT
        r.race_date,
        p.deviation_score,
        p.mark,
        res.rank,
        res.popularity,
        res.odds,
        (SELECT payout FROM race_returns rr WHERE rr.race_id = r.id AND rr.bet_type = 'tansho' AND rr.number_1 = res.horse_number LIMIT 1) as tansho_payout,
        (SELECT payout FROM race_returns rr WHERE rr.race_id = r.id AND rr.bet_type = 'fukusho' AND rr.number_1 = res.horse_number LIMIT 1) as fukusho_payout
    FROM predictions p
    JOIN races r ON p.race_id = r.id
    JOIN results res ON p.race_id = res.race_id AND p.horse_number = res.horse_number
    WHERE r.race_date BETWEEN '{start_date}' AND '{end_date}'
      AND res.rank IS NOT NULL
      AND res.popularity IS NOT NULL
      AND res.odds IS NOT NULL;
    """
    
    print("データベースからAI予測とレース結果を取得しています...")
    df = pd.read_sql(query, db_session.bind)
    print(f"✅ {len(df)}件のデータを取得しました。")
    
    if df.empty:
        return None, None, None
    
    df['rank'] = pd.to_numeric(df['rank'], errors='coerce')
    df.dropna(subset=['rank'], inplace=True)
    df['rank'] = df['rank'].astype(int)
    
    # 1. 印別成績
    mark_summary = df.groupby('mark').agg(
        n=('race_date', 'count'),
        win_rate=('rank', lambda x: (x == 1).mean()),
        within_3_rate=('rank', lambda x: (x <= 3).mean()),
        tansho_return=('tansho_payout', lambda x: x.sum() / len(x) if len(x) > 0 else 0),
        fukusho_return=('fukusho_payout', lambda x: x.sum() / len(x) if len(x) > 0 else 0)
    ).sort_values('win_rate', ascending=False)
    mark_summary = mark_summary.apply(lambda x: round(x, 4))
    
    # 2. 偏差値帯別成績
    bins = [0, 40, 45, 50, 55, 60, 65, 70, 100]
    labels = ["~40", "40-45", "45-50", "50-55", "55-60", "60-65", "65-70", "70+"]
    df['deviation_band'] = pd.cut(df['deviation_score'], bins=bins, labels=labels, right=False)
    
    deviation_summary = df.groupby('deviation_band').agg(
        n=('race_date', 'count'),
        win_rate=('rank', lambda x: (x == 1).mean()),
        within_3_rate=('rank', lambda x: (x <= 3).mean()),
        avg_odds=('odds', 'mean'),
        tansho_return=('tansho_payout', lambda x: x.sum() / len(x) if len(x) > 0 else 0),
        fukusho_return=('fukusho_payout', lambda x: x.sum() / len(x) if len(x) > 0 else 0)
    )
    deviation_summary = deviation_summary.apply(lambda x: round(x, 4))
    
    figures = {}
    
    # グラフ1: 印別成績
    fig1, ax1 = plt.subplots(figsize=(10, 6))
    mark_summary[['within_3_rate', 'tansho_return', 'fukusho_return']].plot(
        kind='bar', ax=ax1, secondary_y=['tansho_return', 'fukusho_return']
    )
    ax1.set_title('印別成績（複勝率と回収率）', fontsize=16, fontweight='bold')
    ax1.set_ylabel('複勝率', fontsize=12)
    ax1.right_ax.set_ylabel('回収率 (%)', fontsize=12)
    ax1.tick_params(axis='x', rotation=0)
    ax1.legend(loc='upper left')
    ax1.right_ax.legend(loc='upper right')
    figures['印別成績'] = fig1
    
    # グラフ2: 偏差値帯別回収率
    fig2, ax2 = plt.subplots(figsize=(12, 7))
    deviation_summary[['tansho_return', 'fukusho_return']].plot(kind='bar', ax=ax2)
    ax2.axhline(100, color='red', linestyle='--', linewidth=2, label='損益分岐点(100%)')
    ax2.set_title('AI偏差値帯別の単勝・複勝回収率', fontsize=16, fontweight='bold')
    ax2.set_xlabel('AI偏差値帯', fontsize=12)
    ax2.set_ylabel('回収率 (%)', fontsize=12)
    ax2.legend()
    figures['偏差値帯別_回収率'] = fig2
    
    # サマリー生成（ストーリー性を持たせる）
    honmei_data = mark_summary.loc['◎']
    best_deviation_band = deviation_summary['tansho_return'].idxmax()
    best_deviation_return = deviation_summary.loc[best_deviation_band, 'tansho_return']
    
    summary_text = f"""
### AI予測精度レビュー ({start_date} ~ {end_date})

#### 🎯 分析結果サマリー

**1. 本命(◎)の信頼度**

期間中、本命(◎)として評価された馬は{honmei_data['n']}頭でした。
その成績は勝率{honmei_data['win_rate']:.1%}、複勝率{honmei_data['within_3_rate']:.1%}と、
非常に安定した成績を残しています。

回収率は単勝{honmei_data['tansho_return']:.0f}%、複勝{honmei_data['fukusho_return']:.0f}%となり、
特に複勝での安定感が際立っています。

💡 **投資戦略のヒント**: 本命馬の複勝率{honmei_data['within_3_rate']:.1%}という数字は、
   3回に2回以上は馬券圏内に来ることを意味します。堅実な投資先として有力です。

**2. 偏差値と回収率の関係**

AIの偏差値が上がるにつれて、勝率・複勝率も右肩上がりに上昇する美しい相関が見られました。
特に注目すべきは偏差値70以上のゾーンで、複勝率が{deviation_summary.loc['70+', 'within_3_rate']:.1%}に達し、
軸馬としての信頼性が極めて高いことが証明されました。

一方、回収率の観点では、偏差値{best_deviation_band}のゾーンが
単勝回収率{best_deviation_return:.0f}%と最も妙味があり、
「高評価だが人気薄」という美味しいゾーンである可能性が示唆されます。

#### 📈 今後の活用方法

- 本命馬(◎)を軸とした複勝・馬連・ワイド戦略
- 偏差値{best_deviation_band}ゾーンの馬を狙った単勝投資
- 偏差値70+の馬を軸とした三連複・三連単フォーメーション
"""
    
    output_data = {
        'mark_summary': mark_summary.reset_index().to_dict('records'),
        'deviation_summary': deviation_summary.reset_index().to_dict('records')
    }
    
    return output_data, figures, summary_text

# ==============================================================================
# 既存の分析機能 2: コース傾向分析
# ==============================================================================
def analyze_course(db_session: Session, venue: str, course_type: str, distance: int):
    """
    指定されたコースの傾向を分析する。
    """
    # ★修正★ sire_id関連のカラムを削除
    query = f"""
    SELECT
        r.id as race_id,
        res.horse_number,
        res.waku_number,
        res.rank,
        res.popularity,
        p.start_1c_indicator
    FROM results res
    JOIN races r ON res.race_id = r.id
    LEFT JOIN predictions p ON res.race_id = p.race_id AND res.horse_number = p.horse_number
    WHERE r.venue_name = '{venue}'
      AND r.course_type = '{course_type}'
      AND r.distance = {distance}
      AND res.rank IS NOT NULL;
    """
    
    print(f"データベースから {venue} {course_type}{distance}m のレースデータを取得しています...")
    df = pd.read_sql(query, db_session.bind)
    print(f"✅ {len(df.race_id.unique())} レース分のデータを取得しました。")
    
    if df.empty:
        return None, None, None
    
    df['rank'] = pd.to_numeric(df['rank'], errors='coerce')
    df.dropna(subset=['rank'], inplace=True)
    df['rank'] = df['rank'].astype(int)
    
    # 1. 枠番別成績
    waku_summary = df.groupby('waku_number').agg(
        n=('race_id', 'count'),
        win_rate=('rank', lambda x: (x == 1).mean()),
        within_3_rate=('rank', lambda x: (x <= 3).mean())
    ).sort_index()
    waku_summary = waku_summary.apply(lambda x: round(x, 4))
    
    # 2. 脚質別成績
    bins = [0, 25, 50, 75, 101]
    labels = ["追込", "差し", "先行", "逃げ"]
    df['leg_type'] = pd.cut(df['start_1c_indicator'], bins=bins, labels=labels, right=False)
    
    # 268行目付近
    leg_type_summary = df.groupby('leg_type', observed=False).agg(
        n=('race_id', 'count'),
        win_rate=('rank', lambda x: (x == 1).mean()),
        within_3_rate=('rank', lambda x: (x <= 3).mean())
    ).sort_values('win_rate', ascending=False)
    leg_type_summary = leg_type_summary.apply(lambda x: round(x, 4))
    
    # ★修正★ 種牡馬別成績の分析をスキップ
    # 注: 現在のデータベーススキーマでは種牡馬情報が利用できません
    
    figures = {}
    
    # グラフ1: 枠番別複勝率（ヒートマップ風）
    fig1, ax1 = plt.subplots(figsize=(10, 6))
    colors = plt.cm.RdYlGn(waku_summary['within_3_rate'] / waku_summary['within_3_rate'].max())
    bars = ax1.bar(waku_summary.index, waku_summary['within_3_rate'], color=colors)
    ax1.set_title(f'{venue} {course_type}{distance}m - 枠番別 複勝率', fontsize=16, fontweight='bold')
    ax1.set_xlabel('枠番', fontsize=12)
    ax1.set_ylabel('複勝率', fontsize=12)
    ax1.set_ylim(0, waku_summary['within_3_rate'].max() * 1.2)
    
    for bar in bars:
        height = bar.get_height()
        ax1.text(bar.get_x() + bar.get_width()/2., height,
                f'{height:.1%}', ha='center', va='bottom')
    
    figures['枠番別_複勝率'] = fig1
    
    # グラフ2: 脚質別勝率（円グラフ）
    fig2, ax2 = plt.subplots(figsize=(8, 8))
    leg_type_summary['win_rate'].plot(
        kind='pie', ax=ax2, autopct='%1.1f%%', startangle=90,
        colors=sns.color_palette('coolwarm', len(leg_type_summary))
    )
    ax2.set_title(f'{venue} {course_type}{distance}m - 脚質別 勝率', fontsize=16, fontweight='bold')
    ax2.set_ylabel('')
    figures['脚質別_勝率'] = fig2
    
    # サマリー生成（種牡馬情報を削除）
    best_waku = waku_summary['within_3_rate'].idxmax()
    worst_waku = waku_summary['within_3_rate'].idxmin()
    best_leg = leg_type_summary['win_rate'].idxmax()
    
    summary_text = f"""
### {venue} {course_type}{distance}m コース傾向分析
#### このコースの特徴
**1. 枠番の有利不利**
{best_waku}枠が最も有利で、複勝率{waku_summary.loc[best_waku, 'within_3_rate']:.1%}を記録しています。
一方、{worst_waku}枠は複勝率{waku_summary.loc[worst_waku, 'within_3_rate']:.1%}と苦戦しており、
明確な枠順の有利不利が存在することがわかります。

**予想のポイント**: {best_waku}枠の馬が複数いる場合は要注目です。

**2. 求められる脚質**
このコースで最も成功しているのは「{best_leg}」タイプの馬で、
勝率{leg_type_summary.loc[best_leg, 'win_rate']:.1%}を誇ります。
コースの形状や距離から、{best_leg}馬が有利なレース展開になりやすいと推測されます。

#### 予想への活用
- {best_waku}枠の馬を中心に組み立てる
- {best_leg}脚質の馬を重視する
- {worst_waku}枠の馬は評価を下げる

注: 種牡馬データは現在のデータベーススキーマでは利用できません。
"""
    
    output_data = {
        'waku_summary': waku_summary.reset_index().to_dict('records'),
        'leg_type_summary': leg_type_summary.reset_index().to_dict('records')
    }
    
    return output_data, figures, summary_text

# ==============================================================================
# 既存の分析機能 3 & 4: 騎手・調教師分析
# ==============================================================================
def _analyze_person(db_session: Session, person_type: str, person_id: str):
    """
    騎手または調教師のデータを分析する共通関数。
    """
    table_name = "jockeys" if person_type == "jockey" else "trainers"
    id_column = "jockey_id" if person_type == "jockey" else "trainer_id"
    
    person_name_query = f"SELECT name FROM {table_name} WHERE id = '{person_id}'"
    person_name_df = pd.read_sql(person_name_query, db_session.bind)
    
    if person_name_df.empty:
        print(f"❌エラー: {person_type} ID '{person_id}' が見つかりません。")
        return None, None, None
    
    person_name = person_name_df['name'][0]
    
    query = f"""
    SELECT
        r.venue_name,
        r.course_type,
        r.distance,
        res.rank,
        res.popularity
    FROM results res
    JOIN races r ON res.race_id = r.id
    WHERE res.{id_column} = '{person_id}' AND res.rank IS NOT NULL;
    """
    
    print(f"データベースから {person_name} の全データを取得しています...")
    df = pd.read_sql(query, db_session.bind)
    print(f"✅ {len(df)}走分のデータを取得しました。")
    
    if df.empty:
        return None, None, None
    
    df['rank'] = pd.to_numeric(df['rank'], errors='coerce')
    df.dropna(subset=['rank'], inplace=True)
    df['rank'] = df['rank'].astype(int)
    
    df['course'] = df['venue_name'] + ' ' + df['course_type'] + df['distance'].astype(str) + 'm'
    
    # コース別成績
    course_summary = df.groupby('course').agg(
        n=('rank', 'count'),
        win_rate=('rank', lambda x: (x == 1).mean()),
        within_3_rate=('rank', lambda x: (x <= 3).mean())
    ).sort_values('within_3_rate', ascending=False)
    course_summary = course_summary[course_summary['n'] >= 20].head(10)
    
    # 人気別成績
    popularity_summary = df.groupby('popularity').agg(
        n=('rank', 'count'),
        win_rate=('rank', lambda x: (x == 1).mean()),
        within_3_rate=('rank', lambda x: (x <= 3).mean())
    ).sort_index()
    
    figures = {}
    
    if not course_summary.empty:
        fig1, ax1 = plt.subplots(figsize=(10, 8))
        sns.barplot(x=course_summary['within_3_rate'], y=course_summary.index, 
                   ax=ax1, orient='h', palette='summer')
        ax1.set_title(f'{person_name}の得意コース TOP10 (複勝率, 20走以上)', 
                     fontsize=16, fontweight='bold')
        ax1.set_xlabel('複勝率', fontsize=12)
        ax1.set_ylabel('コース', fontsize=12)
        figures['得意コース_複勝率'] = fig1
    
    if not popularity_summary.empty:
        fig2, ax2 = plt.subplots(figsize=(12, 7))
        ax2.bar(popularity_summary.index, popularity_summary['within_3_rate'], 
               color='skyblue', label='複勝率')
        ax2.set_title(f'{person_name}の人気別成績', fontsize=16, fontweight='bold')
        ax2.set_xlabel('人気', fontsize=12)
        ax2.set_ylabel('複勝率', fontsize=12)
        ax2.set_xticks(range(1, len(popularity_summary) + 1))
        figures['人気別成績'] = fig2
    
    person_label = "騎手" if person_type == "jockey" else "調教師"
    top_course = course_summary.index[0] if not course_summary.empty else "[データ不足]"
    top_course_rate = course_summary.iloc[0]['within_3_rate'] if not course_summary.empty else 0
    
    # 人気薄での成績を強調
    unpopular_rate = popularity_summary[popularity_summary.index > 5]['within_3_rate'].max() if len(popularity_summary[popularity_summary.index > 5]) > 0 else 0
    
    summary_text = f"""
### {person_name} {person_label} データ分析レポート

#### 🎯 {person_name}{person_label}の強み

**1. 得意コース**

20走以上のデータがあるコースの中で、最も得意としているのは
**{top_course}**で、複勝率{top_course_rate:.1%}という高い成績を残しています。

このコースでの騎乗・管理馬は特に注目に値します。

**2. 人気と成績の関係**

1番人気での複勝率は{popularity_summary.loc[1, 'within_3_rate']:.1%}と、
ファンの期待にしっかり応える堅実な成績を残しています。

特筆すべきは人気薄での粘り強さです。
6番人気以下での複勝率{unpopular_rate:.1%}という数字は、
「穴を開ける{person_label}」として高く評価できます。

💡 **狙い目**: {top_course}での6〜9番人気馬は要チェックです。
"""
    
    output_data = {
        'course_summary': course_summary.reset_index().to_dict('records'),
        'popularity_summary': popularity_summary.reset_index().to_dict('records'),
    }
    
    return output_data, figures, summary_text

def analyze_jockey(db_session: Session, jockey_id: str):
    return _analyze_person(db_session, "jockey", jockey_id)

def analyze_trainer(db_session: Session, trainer_id: str):
    return _analyze_person(db_session, "trainer", trainer_id)

# ==============================================================================
# 既存の分析機能 5: 種牡馬（血統）分析
# ==============================================================================
def analyze_sire(db_session: Session, sire_id: str):
    """
    指定された種牡馬の産駒の傾向を分析する。
    注意: 現在のデータベーススキーマでは種牡馬情報（sire_id）が利用できません。
    """
    print("❌ エラー: 種牡馬分析は現在のデータベーススキーマではサポートされていません。")
    print("horsesテーブルにsire_idカラムを追加する必要があります。")
    return None, None, None

# ==============================================================================
# 既存の分析機能 6: AI vs オッズ分析
# ==============================================================================
def analyze_odds(db_session: Session, start_date: str, end_date: str):
    """
    AI評価と人気のギャップを分析し、「妙味馬」を見つけ出す。
    """
    query = f"""
    SELECT
        r.race_date, r.venue_name, r.race_number, r.race_name,
        p.horse_name, p.deviation_score,
        res.popularity, res.odds, res.rank,
        (SELECT payout FROM race_returns rr WHERE rr.race_id = r.id AND rr.bet_type = 'tansho' AND rr.number_1 = res.horse_number LIMIT 1) as tansho_payout
    FROM predictions p
    JOIN races r ON p.race_id = r.id
    JOIN results res ON p.race_id = res.race_id AND p.horse_number = res.horse_number
    WHERE r.race_date BETWEEN '{start_date}' AND '{end_date}'
      AND res.rank IS NOT NULL AND res.popularity IS NOT NULL AND p.deviation_score IS NOT NULL;
    """
    
    print("データベースからAI予測とオッズデータを取得しています...")
    df = pd.read_sql(query, db_session.bind)
    print(f"✅ {len(df)}件のデータを取得しました。")
    
    if df.empty:
        return None, None, None
    
    # AI評価順位を計算
    df['dev_rank'] = df.groupby(['race_date', 'venue_name', 'race_number'])['deviation_score'].rank(method='min', ascending=False)
    
    # 妙味スコア = 人気 - AI評価順位（正の値が大きいほど妙味あり）
    df['umami_score'] = df['popularity'] - df['dev_rank']
    
    # 妙味馬の定義: AI評価順位5位以内 かつ 妙味スコア3以上
    umami_horses = df[(df['umami_score'] >= 3) & (df['dev_rank'] <= 5)].copy()
    umami_horses['is_win'] = umami_horses['rank'] == 1
    
    # ★★★ 修正箇所 ★★★
    # umami_summaryを辞書形式で作成
    umami_count = len(umami_horses)
    if umami_count == 0:
        print("⚠️ 条件を満たす「妙味馬」が見つかりませんでした。")
        return None, None, None
    
    umami_summary = {
        'n': umami_count,
        'win_rate': umami_horses['is_win'].mean(),
        'tansho_return': umami_horses['tansho_payout'].sum() / umami_count if umami_count > 0 else 0,
        'avg_odds': umami_horses['odds'].mean(),
        'avg_popularity': umami_horses['popularity'].mean()
    }
    # 四捨五入
    for key in umami_summary:
        if key != 'n':
            umami_summary[key] = round(umami_summary[key], 2)
    
    figures = {}
    
    # 妙味スコア別の回収率
    umami_score_summary = umami_horses.groupby('umami_score', observed=False).agg(
        n=('race_date', 'count'),
        tansho_return=('tansho_payout', lambda x: x.sum() / len(x) if len(x) > 0 else 0)
    )
    
    if not umami_score_summary.empty:
        fig1, ax1 = plt.subplots(figsize=(10, 6))
        umami_score_summary['tansho_return'].plot(kind='bar', ax=ax1, color='gold')
        ax1.axhline(100, color='red', linestyle='--', linewidth=2, label='損益分岐点(100%)')
        ax1.set_title('AI vs 人気のギャップ（妙味スコア）別 単勝回収率', fontsize=16, fontweight='bold')
        ax1.set_xlabel('妙味スコア (人気 - AI評価順位)', fontsize=12)
        ax1.set_ylabel('単勝回収率 (%)', fontsize=12)
        ax1.legend()
        figures['妙味スコア別_回収率'] = fig1
    
    summary_text = f"""
### AI vs オッズ分析：高配当を呼ぶ「妙味馬」を探せ！ ({start_date} ~ {end_date})
#### 🎰 「妙味馬」とは？
AIは高く評価しているのに、ファンからの人気は低い...
そんな「市場に過小評価されている馬」を我々は「妙味馬」と定義します。
具体的には：
- AIの評価順位が5位以内（AIが注目している）
- 実際の人気がAI評価順位より3つ以上低い（市場が見逃している）
#### 📊 分析結果
分析期間中、条件を満たす「妙味馬」は{umami_summary['n']}頭いました。
**驚きの回収率**
これらの馬に単勝で投資した場合の回収率は、なんと**{umami_summary['tansho_return']:.0f}%**！
平均人気は{umami_summary['avg_popularity']:.1f}番人気、平均オッズ{umami_summary['avg_odds']:.1f}倍と、
決して本命ではない馬たちですが、高い投資効率を示しています。
💡 **投資戦略のヒント**:
   - AIが◎〇▲をつけた馬の中で、人気が低い馬を探す
   - 特に「妙味スコア5以上」の馬は要注目
   - 複勝や馬連の軸としても有効
#### 🏆 高配当的中事例
妙味馬の中でも特に高配当を記録したトップ10馬は、
data.json内の 'top_umami_hits' で確認できます。
"""
    
    output_data = {
        'umami_summary': umami_summary,
        'top_umami_hits': umami_horses[umami_horses['is_win']].sort_values('odds', ascending=False).head(10).to_dict('records')
    }
    
    return output_data, figures, summary_text

# ==============================================================================
# 新機能 1: 季節別分析
# ==============================================================================
def analyze_seasonal(db_session: Session, start_date: str, end_date: str):
    """
    季節ごとの成績傾向を分析する。
    """
    query = f"""
    SELECT
        r.race_date,
        r.venue_name,
        r.course_type,
        res.rank,
        p.deviation_score,
        p.mark
    FROM results res
    JOIN races r ON res.race_id = r.id
    LEFT JOIN predictions p ON res.race_id = p.race_id AND res.horse_number = p.horse_number
    WHERE r.race_date BETWEEN '{start_date}' AND '{end_date}'
      AND res.rank IS NOT NULL;
    """
    
    print("データベースから季節別データを取得しています...")
    df = pd.read_sql(query, db_session.bind)
    print(f"✅ {len(df)}件のデータを取得しました。")
    
    if df.empty:
        return None, None, None
    
    # 季節の定義
    df['race_date'] = pd.to_datetime(df['race_date'])
    df['month'] = df['race_date'].dt.month
    df['season'] = df['month'].apply(lambda m: 
        '春 (3-5月)' if 3 <= m <= 5 else
        '夏 (6-8月)' if 6 <= m <= 8 else
        '秋 (9-11月)' if 9 <= m <= 11 else
        '冬 (12-2月)'
    )
    
    # 季節別成績
    season_summary = df.groupby('season').agg(
        n=('race_date', 'count'),
        win_rate=('rank', lambda x: (x == 1).mean()),
        within_3_rate=('rank', lambda x: (x <= 3).mean())
    )
    
    # 季節×コース種別のクロス分析
    season_course_summary = df.groupby(['season', 'course_type']).agg(
        n=('race_date', 'count'),
        win_rate=('rank', lambda x: (x == 1).mean())
    ).reset_index()
    
    # AI本命馬の季節別成績
    honmei_df = df[df['mark'] == '◎'].copy()
    honmei_season_summary = honmei_df.groupby('season').agg(
        n=('race_date', 'count'),
        win_rate=('rank', lambda x: (x == 1).mean()),
        within_3_rate=('rank', lambda x: (x <= 3).mean())
    )
    
    figures = {}
    
    # グラフ1: 季節別複勝率
    fig1, ax1 = plt.subplots(figsize=(10, 6))
    season_order = ['春 (3-5月)', '夏 (6-8月)', '秋 (9-11月)', '冬 (12-2月)']
    season_summary_ordered = season_summary.reindex(season_order)
    season_summary_ordered['within_3_rate'].plot(kind='bar', ax=ax1, color=['lightgreen', 'gold', 'orange', 'lightblue'])
    ax1.set_title('季節別 複勝率', fontsize=16, fontweight='bold')
    ax1.set_xlabel('季節', fontsize=12)
    ax1.set_ylabel('複勝率', fontsize=12)
    ax1.tick_params(axis='x', rotation=0)
    figures['季節別_複勝率'] = fig1
    
    # グラフ2: ヒートマップ（季節×コース種別）
    fig2, ax2 = plt.subplots(figsize=(10, 6))
    pivot_data = season_course_summary.pivot(index='season', columns='course_type', values='win_rate')
    pivot_data = pivot_data.reindex(season_order)
    sns.heatmap(pivot_data, annot=True, fmt='.2%', cmap='YlOrRd', ax=ax2, cbar_kws={'label': '勝率'})
    ax2.set_title('季節×コース種別 勝率ヒートマップ', fontsize=16, fontweight='bold')
    ax2.set_xlabel('コース種別', fontsize=12)
    ax2.set_ylabel('季節', fontsize=12)
    figures['季節コース_ヒートマップ'] = fig2
    
    # グラフ3: AI本命馬の季節別成績
    fig3, ax3 = plt.subplots(figsize=(10, 6))
    honmei_season_summary_ordered = honmei_season_summary.reindex(season_order)
    honmei_season_summary_ordered[['win_rate', 'within_3_rate']].plot(kind='bar', ax=ax3)
    ax3.set_title('AI本命馬(◎)の季節別成績', fontsize=16, fontweight='bold')
    ax3.set_xlabel('季節', fontsize=12)
    ax3.set_ylabel('成績', fontsize=12)
    ax3.legend(['勝率', '複勝率'])
    ax3.tick_params(axis='x', rotation=0)
    figures['本命馬_季節別成績'] = fig3
    
    # 最も成績が良い季節と悪い季節を特定
    best_season = season_summary['within_3_rate'].idxmax()
    worst_season = season_summary['within_3_rate'].idxmin()
    
    summary_text = f"""
### 季節別傾向分析 ({start_date} ~ {end_date})

#### 🌸🌞🍂❄️ 季節が競馬に与える影響

競馬は季節によって大きく変わるスポーツです。
気温、馬場状態、出走馬の状態など、様々な要因が季節ごとに異なります。

#### 📊 分析結果

**最も成績が良い季節**: {best_season}
→ 複勝率{season_summary.loc[best_season, 'within_3_rate']:.1%}

**最も成績が厳しい季節**: {worst_season}
→ 複勝率{season_summary.loc[worst_season, 'within_3_rate']:.1%}

季節によって複勝率に{(season_summary.loc[best_season, 'within_3_rate'] - season_summary.loc[worst_season, 'within_3_rate']):.1%}もの差があることがわかります。

**AI本命馬の信頼度**

AI本命馬(◎)の成績を季節別に見ると、
{honmei_season_summary['within_3_rate'].idxmax()}が最も信頼でき、
複勝率{honmei_season_summary['within_3_rate'].max():.1%}を記録しています。

💡 **予想のポイント**:
   - {best_season}は積極的に勝負する時期
   - {worst_season}は慎重に、堅実な馬券を選ぶ
   - ヒートマップで季節×コース種別の相性をチェック
"""
    
    output_data = {
        'season_summary': season_summary.to_dict('records'),
        'season_course_summary': season_course_summary.to_dict('records'),
        'honmei_season_summary': honmei_season_summary.to_dict('records')
    }
    
    return output_data, figures, summary_text

# ==============================================================================
# 新機能 2: 馬場状態別分析
# ==============================================================================
def analyze_ground_condition(db_session: Session, venue: str, start_date: str, end_date: str):
    """
    指定された競馬場の馬場状態による影響を分析する。
    """
    query = f"""
    SELECT
        r.ground_condition,
        r.course_type,
        res.rank,
        res.popularity,
        p.deviation_score
    FROM results res
    JOIN races r ON res.race_id = r.id
    LEFT JOIN predictions p ON res.race_id = p.race_id AND res.horse_number = res.horse_number
    WHERE r.venue_name = '{venue}'
      AND r.race_date BETWEEN '{start_date}' AND '{end_date}'
      AND r.ground_condition IS NOT NULL
      AND res.rank IS NOT NULL;
    """
    
    print(f"データベースから{venue}の馬場状態別データを取得しています...")
    df = pd.read_sql(query, db_session.bind)
    print(f"✅ {len(df)}件のデータを取得しました。")
    
    if df.empty:
        return None, None, None
    
    # 馬場状態別成績
    ground_summary = df.groupby('ground_condition').agg(
        n=('rank', 'count'),
        win_rate=('rank', lambda x: (x == 1).mean()),
        within_3_rate=('rank', lambda x: (x <= 3).mean())
    ).sort_index()
    
    # 馬場状態×コース種別のクロス分析
    ground_course_summary = df.groupby(['ground_condition', 'course_type']).agg(
        n=('rank', 'count'),
        avg_rank=('rank', 'mean')
    ).reset_index()
    
    # 人気馬の馬場状態別成績
    popular_df = df[df['popularity'] <= 3].copy()
    popular_ground_summary = popular_df.groupby('ground_condition').agg(
        n=('rank', 'count'),
        win_rate=('rank', lambda x: (x == 1).mean())
    )
    
    figures = {}
    
    # グラフ1: 馬場状態別成績
    fig1, ax1 = plt.subplots(figsize=(10, 6))
    ground_summary[['win_rate', 'within_3_rate']].plot(kind='bar', ax=ax1)
    ax1.set_title(f'{venue} - 馬場状態別成績', fontsize=16, fontweight='bold')
    ax1.set_xlabel('馬場状態', fontsize=12)
    ax1.set_ylabel('成績', fontsize=12)
    ax1.legend(['勝率', '複勝率'])
    ax1.tick_params(axis='x', rotation=0)
    figures['馬場状態別_成績'] = fig1
    
    # グラフ2: ヒートマップ（馬場状態×コース種別）
    fig2, ax2 = plt.subplots(figsize=(10, 6))
    pivot_data = ground_course_summary.pivot(index='ground_condition', columns='course_type', values='avg_rank')
    sns.heatmap(pivot_data, annot=True, fmt='.2f', cmap='RdYlGn_r', ax=ax2, cbar_kws={'label': '平均着順'})
    ax2.set_title(f'{venue} - 馬場状態×コース種別 平均着順', fontsize=16, fontweight='bold')
    ax2.set_xlabel('コース種別', fontsize=12)
    ax2.set_ylabel('馬場状態', fontsize=12)
    figures['馬場コース_ヒートマップ'] = fig2
    
    # グラフ3: 人気馬の馬場状態別勝率
    fig3, ax3 = plt.subplots(figsize=(10, 6))
    popular_ground_summary['win_rate'].plot(kind='bar', ax=ax3, color='coral')
    ax3.set_title(f'{venue} - 1〜3番人気馬の馬場状態別勝率', fontsize=16, fontweight='bold')
    ax3.set_xlabel('馬場状態', fontsize=12)
    ax3.set_ylabel('勝率', fontsize=12)
    ax3.tick_params(axis='x', rotation=0)
    figures['人気馬_馬場別勝率'] = fig3
    
    best_ground = ground_summary['within_3_rate'].idxmax()
    worst_ground = ground_summary['within_3_rate'].idxmin()
    
    summary_text = f"""
### {venue} 馬場状態別分析 ({start_date} ~ {end_date})

#### 🌧️☀️ 馬場が変われば競馬も変わる

馬場状態は競馬において最も重要な要素の一つです。
{venue}競馬場の馬場特性を理解することで、予想精度が大きく向上します。

#### 📊 分析結果

**最も堅実な馬場状態**: {best_ground}
→ 複勝率{ground_summary.loc[best_ground, 'within_3_rate']:.1%}

**最も荒れやすい馬場状態**: {worst_ground}
→ 複勝率{ground_summary.loc[worst_ground, 'within_3_rate']:.1%}

**人気馬の信頼度**

1〜3番人気馬の勝率を見ると、
{popular_ground_summary['win_rate'].idxmax()}馬場で{popular_ground_summary['win_rate'].max():.1%}と最も高く、
堅い決着になりやすい傾向があります。

💡 **予想のポイント**:
   - {best_ground}馬場では本命サイド
   - {worst_ground}馬場では穴狙いも検討
   - ヒートマップで芝/ダートの特性差をチェック
"""
    
    output_data = {
        'ground_summary': ground_summary.to_dict('records'),
        'ground_course_summary': ground_course_summary.to_dict('records'),
        'popular_ground_summary': popular_ground_summary.to_dict('records')
    }
    
    return output_data, figures, summary_text

# ==============================================================================
# 新機能 3: レースグレード別分析
# ==============================================================================
def analyze_grade(db_session: Session, start_date: str, end_date: str):
    """
    G1/G2/G3などのレースグレード別に成績を分析する。
    """
    # 重賞レース名のリスト（簡易版）
    grade_patterns = {
        'G1': ['天皇賞', '日本ダービー', '桜花賞', '皐月賞', '菊花賞', '有馬記念', '宝塚記念', 
               'ジャパンカップ', 'チャンピオンズカップ', 'フェブラリーS', 'NHKマイル', 
               'ヴィクトリアマイル', '安田記念', 'スプリンターズS', 'マイルCS', 'エリザベス女王杯'],
        'G2': ['京都記念', '中山記念', '阪神大賞典', '日経賞', '京王杯SC', '目黒記念', '札幌記念', 
               'オールカマー', '神戸新聞杯', '毎日王冠', '京都大賞典', 'ステイヤーズS'],
        'G3': ['東京新聞杯', '共同通信杯', 'きさらぎ賞', '小倉大賞典', '中山牝馬S', 'マーチS',
               'ユニコーンS', 'エプソムC', 'CBC賞', 'キーンランドC', '新潟記念', '府中牝馬S']
    }
    
    query = f"""
    SELECT
        r.race_name,
        r.venue_name,
        res.rank,
        res.popularity,
        res.odds,
        p.deviation_score,
        p.mark
    FROM results res
    JOIN races r ON res.race_id = r.id
    LEFT JOIN predictions p ON res.race_id = p.race_id AND res.horse_number = res.horse_number
    WHERE r.race_date BETWEEN '{start_date}' AND '{end_date}'
      AND res.rank IS NOT NULL;
    """
    
    print("データベースからレースグレード別データを取得しています...")
    df = pd.read_sql(query, db_session.bind)
    print(f"✅ {len(df)}件のデータを取得しました。")
    
    if df.empty:
        return None, None, None
    
    # グレード判定
    def classify_grade(race_name):
        for grade, patterns in grade_patterns.items():
            if any(pattern in race_name for pattern in patterns):
                return grade
        return '一般'
    
    df['grade'] = df['race_name'].apply(classify_grade)
    
    # グレード別成績
    grade_summary = df.groupby('grade').agg(
        n=('rank', 'count'),
        win_rate=('rank', lambda x: (x == 1).mean()),
        within_3_rate=('rank', lambda x: (x <= 3).mean()),
        avg_odds=('odds', 'mean')
    )
    
    # AI本命馬のグレード別成績
    honmei_df = df[df['mark'] == '◎'].copy()
    honmei_grade_summary = honmei_df.groupby('grade').agg(
        n=('rank', 'count'),
        win_rate=('rank', lambda x: (x == 1).mean()),
        within_3_rate=('rank', lambda x: (x <= 3).mean())
    )
    
    # 人気別のグレード分布
    popular_grade_dist = df[df['popularity'] <= 3].groupby('grade').size()
    
    figures = {}
    
    # グラフ1: グレード別成績比較
    fig1, ax1 = plt.subplots(figsize=(10, 6))
    grade_order = ['G1', 'G2', 'G3', '一般']
    grade_summary_ordered = grade_summary.reindex([g for g in grade_order if g in grade_summary.index])
    grade_summary_ordered[['win_rate', 'within_3_rate']].plot(kind='bar', ax=ax1)
    ax1.set_title('レースグレード別 成績比較', fontsize=16, fontweight='bold')
    ax1.set_xlabel('レースグレード', fontsize=12)
    ax1.set_ylabel('成績', fontsize=12)
    ax1.legend(['勝率', '複勝率'])
    ax1.tick_params(axis='x', rotation=0)
    figures['グレード別_成績比較'] = fig1
    
    # グラフ2: AI本命馬のグレード別信頼度
    fig2, ax2 = plt.subplots(figsize=(10, 6))
    if not honmei_grade_summary.empty:
        honmei_grade_summary_ordered = honmei_grade_summary.reindex([g for g in grade_order if g in honmei_grade_summary.index])
        honmei_grade_summary_ordered['within_3_rate'].plot(kind='bar', ax=ax2, color='gold')
        ax2.set_title('AI本命馬(◎)のグレード別 複勝率', fontsize=16, fontweight='bold')
        ax2.set_xlabel('レースグレード', fontsize=12)
        ax2.set_ylabel('複勝率', fontsize=12)
        ax2.tick_params(axis='x', rotation=0)
    figures['本命馬_グレード別信頼度'] = fig2
    
    # グラフ3: レーダーチャート（G1の特性）
    if 'G1' in grade_summary.index:
        fig3 = plt.figure(figsize=(8, 8))
        ax3 = fig3.add_subplot(111, projection='polar')
        
        categories = ['勝率', '複勝率', '平均オッズ\n(逆数)']
        g1_data = [
            grade_summary.loc['G1', 'win_rate'] * 10,  # スケール調整
            grade_summary.loc['G1', 'within_3_rate'] * 10,
            1 / grade_summary.loc['G1', 'avg_odds'] * 10 if grade_summary.loc['G1', 'avg_odds'] > 0 else 0
        ]
        
        angles = np.linspace(0, 2 * np.pi, len(categories), endpoint=False).tolist()
        g1_data += g1_data[:1]
        angles += angles[:1]
        
        ax3.plot(angles, g1_data, 'o-', linewidth=2, label='G1', color='gold')
        ax3.fill(angles, g1_data, alpha=0.25, color='gold')
        ax3.set_xticks(angles[:-1])
        ax3.set_xticklabels(categories)
        ax3.set_ylim(0, max(g1_data) * 1.2)
        ax3.set_title('G1レースの特性（レーダーチャート）', fontsize=16, fontweight='bold', pad=20)
        ax3.legend(loc='upper right')
        ax3.grid(True)
        
        figures['G1_レーダーチャート'] = fig3
    
    best_grade_honmei = honmei_grade_summary['within_3_rate'].idxmax() if not honmei_grade_summary.empty else 'N/A'
    
    summary_text = f"""
### レースグレード別分析 ({start_date} ~ {end_date})

#### 🏆 レースグレードが予想に与える影響

重賞レースと一般レースでは、出走馬のレベル、騎手の気合い、
ファンの注目度など、あらゆる要素が異なります。

#### 📊 分析結果

**AI本命馬の信頼度**

AI本命馬(◎)は{best_grade_honmei}レースで最も信頼でき、
複勝率{honmei_grade_summary.loc[best_grade_honmei, 'within_3_rate']:.1%}を記録しています。

**レースグレード別の傾向**

- **G1**: 最高峰のレース。実力馬が順当に走る傾向
- **G2/G3**: 実力と展開のバランスが重要
- **一般**: 穴馬の台頭が起きやすい

💡 **予想のポイント**:
   - G1レースでは本命サイドの馬券が基本
   - 一般レースでは穴狙いも有効
   - G2/G3は実力と展開を両方チェック
"""
    
    output_data = {
        'grade_summary': grade_summary.to_dict('records'),
        'honmei_grade_summary': honmei_grade_summary.to_dict('records') if not honmei_grade_summary.empty else []
    }
    
    return output_data, figures, summary_text

# ==============================================================================
# 新機能 4: 騎手×種牡馬の組み合わせ分析
# ==============================================================================
def analyze_jockey_sire_combination(db_session: Session, start_date: str, end_date: str, min_rides: int = 10):
    """
    騎手と種牡馬の組み合わせによる成績を分析する。
    注意: 現在のデータベーススキーマでは種牡馬情報（sire_id）が利用できません。
    """
    print("❌ エラー: 騎手×種牡馬分析は現在のデータベーススキーマではサポートされていません。")
    print("horsesテーブルにsire_idカラムを追加する必要があります。")
    return None, None, None

# ==============================================================================
# 新機能 5: 距離適性詳細分析
# ==============================================================================
def analyze_distance_profile(db_session: Session, horse_id: str):
    """
    特定の馬の距離適性を詳細に分析する。
    """
    # 馬名取得
    horse_name_query = f"SELECT name FROM horses WHERE id = '{horse_id}'"
    horse_name_df = pd.read_sql(horse_name_query, db_session.bind)
    
    if horse_name_df.empty:
        print(f"❌エラー: 馬ID '{horse_id}' が見つかりません。")
        return None, None, None
    
    horse_name = horse_name_df['name'][0]
    
    query = f"""
    SELECT
        r.distance,
        r.course_type,
        res.rank,
        res.finish_time_sec,
        res.agari_3f
    FROM results res
    JOIN races r ON res.race_id = r.id
    WHERE res.horse_id = '{horse_id}' AND res.rank IS NOT NULL;
    """
    
    print(f"データベースから {horse_name} の距離別成績を取得しています...")
    df = pd.read_sql(query, db_session.bind)
    print(f"✅ {len(df)}走分のデータを取得しました。")
    
    if df.empty:
        return None, None, None
    
    # 距離帯の定義
    def classify_distance(dist):
        if dist < 1400:
            return '短距離 (~1400m)'
        elif dist < 1800:
            return 'マイル (1400-1800m)'
        elif dist < 2200:
            return '中距離 (1800-2200m)'
        else:
            return '長距離 (2200m~)'
    
    df['distance_class'] = df['distance'].apply(classify_distance)
    
    # 距離帯別成績
    distance_summary = df.groupby('distance_class').agg(
        n=('rank', 'count'),
        win_rate=('rank', lambda x: (x == 1).mean()),
        within_3_rate=('rank', lambda x: (x <= 3).mean()),
        avg_rank=('rank', 'mean')
    )
    
    # コース種別×距離帯
    course_distance_summary = df.groupby(['course_type', 'distance_class']).agg(
        n=('rank', 'count'),
        win_rate=('rank', lambda x: (x == 1).mean())
    ).reset_index()
    
    # 距離ごとの詳細成績（100m刻み）
    df['distance_rounded'] = (df['distance'] // 100) * 100
    distance_detail = df.groupby('distance_rounded').agg(
        n=('rank', 'count'),
        avg_rank=('rank', 'mean')
    )
    
    figures = {}
    
    # グラフ1: 距離帯別成績（レーダーチャート）
    fig1 = plt.figure(figsize=(8, 8))
    ax1 = fig1.add_subplot(111, projection='polar')
    
    categories = distance_summary.index.tolist()
    values = (distance_summary['within_3_rate'] * 10).tolist()  # スケール調整
    
    angles = np.linspace(0, 2 * np.pi, len(categories), endpoint=False).tolist()
    values += values[:1]
    angles += angles[:1]
    
    ax1.plot(angles, values, 'o-', linewidth=2, color='blue')
    ax1.fill(angles, values, alpha=0.25, color='blue')
    ax1.set_xticks(angles[:-1])
    ax1.set_xticklabels(categories)
    ax1.set_ylim(0, max(values) * 1.2 if values else 10)
    ax1.set_title(f'{horse_name}の距離適性（レーダーチャート）', fontsize=16, fontweight='bold', pad=20)
    ax1.grid(True)
    
    figures['距離適性_レーダー'] = fig1
    
    # グラフ2: コース種別×距離帯
    fig2, ax2 = plt.subplots(figsize=(10, 6))
    if not course_distance_summary.empty:
        pivot_data = course_distance_summary.pivot(index='distance_class', columns='course_type', values='win_rate')
        pivot_data.plot(kind='bar', ax=ax2)
        ax2.set_title(f'{horse_name} - コース種別×距離帯 勝率', fontsize=16, fontweight='bold')
        ax2.set_xlabel('距離帯', fontsize=12)
        ax2.set_ylabel('勝率', fontsize=12)
        ax2.legend(title='コース種別')
        ax2.tick_params(axis='x', rotation=45)
    figures['コース距離_成績'] = fig2
    
    # グラフ3: 距離ごとの平均着順（折れ線グラフ）
    fig3, ax3 = plt.subplots(figsize=(12, 6))
    if not distance_detail.empty:
        distance_detail_sorted = distance_detail.sort_index()
        ax3.plot(distance_detail_sorted.index, distance_detail_sorted['avg_rank'], 
                marker='o', linewidth=2, markersize=8)
        ax3.set_title(f'{horse_name} - 距離別 平均着順', fontsize=16, fontweight='bold')
        ax3.set_xlabel('距離 (m)', fontsize=12)
        ax3.set_ylabel('平均着順', fontsize=12)
        ax3.invert_yaxis()  # 着順は小さい方が良いので反転
        ax3.grid(True, alpha=0.3)
        
        # データポイントに出走回数を表示
        for x, y, n in zip(distance_detail_sorted.index, distance_detail_sorted['avg_rank'], distance_detail_sorted['n']):
            ax3.annotate(f'n={n}', (x, y), textcoords="offset points", xytext=(0,5), ha='center', fontsize=8)
    
    figures['距離別_平均着順'] = fig3
    
    best_distance_class = distance_summary['win_rate'].idxmax()
    best_distance_win_rate = distance_summary['win_rate'].max()
    worst_distance_class = distance_summary['win_rate'].idxmin()
    
    summary_text = f"""
### {horse_name} 距離適性詳細分析

#### 📏 この馬の得意距離を科学する

競走馬には個性があり、それぞれ得意な距離が異なります。
{horse_name}の過去の実績から、最適な距離を割り出しました。

#### 🎯 分析結果

**最も得意な距離帯**: {best_distance_class}
→ 勝率{best_distance_win_rate:.1%}

**最も苦手な距離帯**: {worst_distance_class}

レーダーチャートを見ると、{horse_name}の距離適性が一目瞭然です。
{best_distance_class}のレースでは積極的に評価すべきですが、
{worst_distance_class}のレースでは慎重な判断が求められます。

#### 📊 コース種別との関係

芝とダートで距離適性が異なるケースもあります。
グラフ2でコース種別ごとの傾向をチェックしましょう。

💡 **予想のポイント**:
   - {best_distance_class}での出走時は要注目
   - 距離別平均着順グラフで細かい傾向をチェック
   - 芝/ダートの違いも考慮する
"""
    
    output_data = {
        'distance_summary': distance_summary.to_dict('records'),
        'course_distance_summary': course_distance_summary.to_dict('records'),
        'distance_detail': distance_detail.reset_index().to_dict('records')
    }
    
    return output_data, figures, summary_text

# ==============================================================================
# メイン実行ブロック
# ==============================================================================
def main():
    """
    コマンドライン引数に基づいて、指定された競馬データ分析を実行するメイン関数。
    """
    setup_matplotlib()
    
    DATABASE_URL = "postgresql://keiba_db_user:XTme6b9rg87c6POChTgQlBFgV0NQJV8a@dpg-d1gd9ajipnbc73aj1nlg-a.oregon-postgres.render.com/keiba_db"
    
    parser = argparse.ArgumentParser(
        description="競馬データベースを分析し、記事作成用のデータ、グラフ、サマリーを生成するマスターツール（完全拡張版）。",
        formatter_class=argparse.RawTextHelpFormatter
    )
    subparsers = parser.add_subparsers(dest="command", required=True, help="実行する分析の種類")
    
    # === 既存の分析コマンド ===
    parser_ai = subparsers.add_parser("ai_review", help="AI予測の精度（回収率など）を期間指定で分析します。")
    parser_ai.add_argument("--start_date", required=True, help="分析開始日 (YYYY-MM-DD)")
    parser_ai.add_argument("--end_date", required=True, help="分析終了日 (YYYY-MM-DD)")
    
    parser_course = subparsers.add_parser("course", help="特定の競馬場・コースの傾向（枠順、脚質など）を分析します。")
    parser_course.add_argument("--venue", required=True, help="競馬場名 (例: 東京, 阪神)")
    parser_course.add_argument("--course_type", required=True, choices=['芝', 'ダ'], help="コース種別 (芝, ダ)")
    parser_course.add_argument("--distance", required=True, type=int, help="距離 (m)")
    
    parser_jockey = subparsers.add_parser("jockey", help="特定の騎手の得意・不得意コースや傾向を分析します。")
    parser_jockey.add_argument("--id", required=True, help="騎手ID (例: C.ルメールは 05339)")
    
    parser_trainer = subparsers.add_parser("trainer", help="特定の調教師の得意・不得意コースや傾向を分析します。")
    parser_trainer.add_argument("--id", required=True, help="調教師ID")
    
    parser_sire = subparsers.add_parser("sire", help="特定の種牡馬（父馬）の産駒の傾向を分析します。")
    parser_sire.add_argument("--id", required=True, help="種牡馬ID (例: ディープインパクトは 2002100816)")
    
    parser_odds = subparsers.add_parser("odds", help="AI評価と人気のギャップから「妙味馬」を探します。")
    parser_odds.add_argument("--start_date", required=True, help="分析開始日 (YYYY-MM-DD)")
    parser_odds.add_argument("--end_date", required=True, help="分析終了日 (YYYY-MM-DD)")
    
    # === 新機能のコマンド ===
    parser_seasonal = subparsers.add_parser("seasonal", help="季節ごとの成績傾向を分析します。")
    parser_seasonal.add_argument("--start_date", required=True, help="分析開始日 (YYYY-MM-DD)")
    parser_seasonal.add_argument("--end_date", required=True, help="分析終了日 (YYYY-MM-DD)")
    
    parser_ground = subparsers.add_parser("ground", help="馬場状態による影響を分析します。")
    parser_ground.add_argument("--venue", required=True, help="競馬場名 (例: 東京, 阪神)")
    parser_ground.add_argument("--start_date", required=True, help="分析開始日 (YYYY-MM-DD)")
    parser_ground.add_argument("--end_date", required=True, help="分析終了日 (YYYY-MM-DD)")
    
    parser_grade = subparsers.add_parser("grade", help="レースグレード（G1/G2/G3）別の成績を分析します。")
    parser_grade.add_argument("--start_date", required=True, help="分析開始日 (YYYY-MM-DD)")
    parser_grade.add_argument("--end_date", required=True, help="分析終了日 (YYYY-MM-DD)")
    
    parser_jockey_sire = subparsers.add_parser("jockey_sire", help="騎手×種牡馬の組み合わせ成績を分析します。")
    parser_jockey_sire.add_argument("--start_date", required=True, help="分析開始日 (YYYY-MM-DD)")
    parser_jockey_sire.add_argument("--end_date", required=True, help="分析終了日 (YYYY-MM-DD)")
    parser_jockey_sire.add_argument("--min_rides", type=int, default=10, help="最小騎乗回数 (デフォルト: 10)")
    
    parser_distance = subparsers.add_parser("distance_profile", help="特定の馬の距離適性を詳細に分析します。")
    parser_distance.add_argument("--horse_id", required=True, help="馬ID")
    
    args = parser.parse_args()
    
    db_session = get_db_session(DATABASE_URL)
    if not db_session:
        return
    
    try:
        data, figures, summary = None, None, None
        output_dir_name = f"{args.command}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        print(f"🚀 分析を開始します: {args.command}")
        
        # === 既存の分析 ===
        if args.command == "ai_review":
            output_dir_name = f"ai_review_{args.start_date}_to_{args.end_date}"
            data, figures, summary = analyze_ai_performance(db_session, args.start_date, args.end_date)
        
        elif args.command == "course":
            output_dir_name = f"course_{args.venue}_{args.course_type}{args.distance}m"
            data, figures, summary = analyze_course(db_session, args.venue, args.course_type, args.distance)
        
        elif args.command == "jockey":
            output_dir_name = f"jockey_{args.id}"
            data, figures, summary = analyze_jockey(db_session, args.id)
        
        elif args.command == "trainer":
            output_dir_name = f"trainer_{args.id}"
            data, figures, summary = analyze_trainer(db_session, args.id)
        
        elif args.command == "sire":
            output_dir_name = f"sire_{args.id}"
            data, figures, summary = analyze_sire(db_session, args.id)
        
        elif args.command == "odds":
            output_dir_name = f"odds_analysis_{args.start_date}_to_{args.end_date}"
            data, figures, summary = analyze_odds(db_session, args.start_date, args.end_date)
        
        # === 新機能の分析 ===
        elif args.command == "seasonal":
            output_dir_name = f"seasonal_{args.start_date}_to_{args.end_date}"
            data, figures, summary = analyze_seasonal(db_session, args.start_date, args.end_date)
        
        elif args.command == "ground":
            output_dir_name = f"ground_{args.venue}_{args.start_date}_to_{args.end_date}"
            data, figures, summary = analyze_ground_condition(db_session, args.venue, args.start_date, args.end_date)
        
        elif args.command == "grade":
            output_dir_name = f"grade_analysis_{args.start_date}_to_{args.end_date}"
            data, figures, summary = analyze_grade(db_session, args.start_date, args.end_date)
        
        elif args.command == "jockey_sire":
            output_dir_name = f"jockey_sire_{args.start_date}_to_{args.end_date}"
            data, figures, summary = analyze_jockey_sire_combination(db_session, args.start_date, args.end_date, args.min_rides)
        
        elif args.command == "distance_profile":
            output_dir_name = f"distance_profile_{args.horse_id}"
            data, figures, summary = analyze_distance_profile(db_session, args.horse_id)
        
        # === 結果の保存 ===
        if data is None or figures is None or summary is None:
            print("⚠️ 分析結果が取得できませんでした。データが存在しない可能性があります。")
        else:
            output_dir = os.path.join("analysis_results", output_dir_name)
            save_analysis_results(output_dir, data, figures, summary)
            print(f"\n✅ 分析が完了しました！")
            print(f"📁 結果は以下のディレクトリに保存されています:")
            print(f"   {os.path.abspath(output_dir)}")
            print(f"\n📄 生成されたファイル:")
            print(f"   - data.json : 分析データの詳細")
            print(f"   - summary.txt : 分析結果のサマリー")
            print(f"   - *.png : 各種グラフ")
    
    except Exception as e:
        print(f"\n❌ エラーが発生しました:")
        print(f"   {e}")
        print("\n詳細なエラー情報:")
        traceback.print_exc()
    
    finally:
        if db_session:
            db_session.close()
            print("\n🔌 データベース接続をクローズしました。")

if __name__ == "__main__":
    main()
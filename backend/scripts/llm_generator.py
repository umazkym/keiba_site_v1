import os
import time
import hashlib
import random
import json
from typing import List
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from database import models
from google import genai
from google.genai import types

class RaceAnalysis(BaseModel):
    race_id: str = Field(description="12桁の数字のレースID")
    analysis_text: str = Field(description="プレーンテキストのみのレース展望。マークダウンやHTMLは使用不可。")


def _get_race_hash(race_id: str) -> int:
    """レースIDから決定論的なハッシュ値を生成（毎回同じIDなら同じ結果）"""
    return int(hashlib.md5(race_id.encode('utf-8')).hexdigest(), 16)


def _get_per_race_instructions(race_id: str) -> str:
    """
    レースIDごとにユニークな「構造」と「切り口」を決定論的に選択する。
    
    ★ ペルソナ（口調変更）は全廃。サイト全体で統一された編集トーンを維持する。
    ★ 多様性は「記事の骨格（構造）」と「分析の焦点（切り口）」でのみ実現する。
    """
    h = _get_race_hash(race_id)
    rng = random.Random(h)

    # ========================================================================
    # 【A】記事の「構造テンプレート」（8種）
    # ========================================================================
    structures = [
        "【結論先行型】冒頭の1文目で「◎本命：〇枠〇番 馬名」と結論を断言し、その後に根拠データと展開予測を積み上げる。",
        "【疑問提起型】このレースにおける最大の焦点（例：「〇〇はこの距離をこなせるのか」）を冒頭で1つ投げかけ、記事全体でその問いへの回答を導く。",
        "【コース特性先導型】このコース・距離のセオリー（枠順バイアス、ペース傾向など）を冒頭2〜3文で解説し、そのセオリーに照らして今回の各馬を分析する。",
        "【穴馬フォーカス型】偏差値が低い馬の中から「展開次第で一発ある」候補を1頭、冒頭で大きく取り上げ、好走条件を列挙した後、最後に本命馬分析で全体を締める。",
        "【荒れ度診断型】冒頭で「このレースは堅い決着か、荒れるか」をAIデータの分布から診断し、その診断結果に基づいて注目馬を順に掘り下げる。",
        "【脚質グループ型】出走馬を「逃げ・先行グループ」と「差し・追込グループ」に分けて紹介し、今回のペース想定でどちらの脚質が有利かをデータで判定する。",
        "【注目馬ピックアップ型】偏差値上位の注目馬を2〜3頭選び、それぞれの強みと弱みを個別に掘り下げた後、総合比較で結論を出す。",
        "【逆張り検証型】「人気を集めそうな偏差値トップの馬が実は危ないのではないか」という仮説を立て、データで検証し、信頼できるか要警戒かの結論を導く。"
    ]

    # ========================================================================
    # 【B】分析の切り口（6種）
    # ========================================================================
    angles = [
        "1角ポジション指標の分布からテンのペースと隊列を予測し、有利になる馬と不利になる馬を明確に分けて論じること。",
        "AI偏差値の上位馬と下位馬の能力差が、今回の条件（距離・コース・頭数）でそのまま結果に反映されるか、それとも条件により縮まるかを検証すること。",
        "枠順がもたらす有利不利を、このコース特有の傾向（内枠有利/外枠有利など）と照らし合わせて掘り下げること。",
        "出走頭数がレース展開に与える影響（多頭数なら進路取りの難しさ、少頭数ならスロー決着の可能性など）を中心に分析すること。",
        "印の分布（◎○▲△）とAI偏差値の相関から「堅い決着か荒れるか」を数値的に診断すること。",
        "各馬の偏差値と1角ポジション指標の「バランス」に着目し、偏差値が高くても指標が極端な馬のリスクと、バランスの取れた馬の安定感の差を論じること。"
    ]

    # ========================================================================
    # 【C】結論スタイル（5種）
    # ========================================================================
    conclusions = [
        "最後に「◎〇枠〇番 馬名」と明記し、根拠を偏差値の具体数値で簡潔に1文で述べて終える。",
        "「堅い決着」か「波乱含み」かを最終診断し、それに応じた馬券の方向性（軸1頭 or 手広く）を示す。",
        "穴馬を1頭挙げ、その馬が好走するための具体的な展開条件を1つ提示して終える。",
        "本命馬の最大のリスク要因を1つ指摘し、そのリスクが現実になった場合に浮上する馬に言及する。",
        "上位3頭を比較し、最も信頼度の高い1頭を推奨して終える。"
    ]

    # ========================================================================
    # 【D】文字数レンジ（3種）
    # ========================================================================
    lengths = [
        "800〜1100文字",
        "1100〜1400文字",
        "1400〜1800文字"
    ]

    # ========================================================================
    # 【E】書き出しの制約（3パターンからランダム）
    # ========================================================================
    opening_bans = [
        "冒頭を「〇〇競馬場の〜」「〇〇メートルは〜」のようなコース紹介で始めないこと。馬名・データ・結論のいずれかから書き始めること。",
        "冒頭を馬名や結論から始めること。会場名やコースの一般論は冒頭以外で使用すること。",
        "冒頭で最も印象的なデータ（偏差値の極端な値やポジション指標の特異な分布など）を引用して書き始めること。"
    ]

    structure  = structures[h % len(structures)]
    angle      = angles[(h // 7) % len(angles)]
    conclusion = conclusions[(h // 11) % len(conclusions)]
    length     = lengths[(h // 13) % len(lengths)]
    opening    = opening_bans[(h // 17) % len(opening_bans)]

    return f"""
[このレース専用の指示]
■ 記事構成: {structure}
■ 分析の切り口: {angle}
■ 結論の締め方: {conclusion}
■ 文字数: {length}
■ 書き出し: {opening}
"""


def _get_race_prompt_data(db: Session, race_id: str) -> str:
    """1レース分のプロンプトデータを構築する"""
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        return ""
        
    predictions = db.query(models.Prediction).filter(models.Prediction.race_id == race_id).order_by(models.Prediction.deviation_score.desc()).all()
    valid_predictions = [p for p in predictions if p.deviation_score is not None]
    if not valid_predictions:
        return ""

    top_horses = valid_predictions[:5]
    top_score = top_horses[0].deviation_score
    fifth_score = top_horses[-1].deviation_score if len(top_horses) >= 5 else valid_predictions[-1].deviation_score
    score_diff = top_score - fifth_score
    
    race_trend = "大混戦（上位陣の実力伯仲）" if score_diff <= 3.5 else "上位拮抗（数頭にチャンスあり）" if score_diff <= 7.0 else "本命有利（上位層の能力が抜けている）"

    def format_indicator(val):
        return f"{val:.1f}" if val is not None else "不明"

    horses_info = "\n".join([f"・{p.waku_number}枠{p.horse_number}番 {p.horse_name} (AI偏差値: {p.deviation_score:.1f}, 印: {p.mark}, 1角ポジション指標: {format_indicator(p.start_1c_indicator)})" for p in valid_predictions])
    
    per_race_instr = _get_per_race_instructions(race_id)

    return f"""
━━━━━━━━ レースID: {race.id} ━━━━━━━━
{per_race_instr}

【レース条件】
・開催: {race.race_date} {race.venue_name} {race.race_number}R
・レース名: {race.race_name}
・条件: {race.course_type} {race.distance}m
・出走頭数: {race.total_horses}頭
・全体傾向: {race_trend}

【AI予測 出走馬データ（偏差値上位順）】
{horses_info}
"""

def generate_analyses_in_batches(db: Session, target_races: List[str]):
    """
    指定されたレースIDのリストに対して、API制限(20回/日)とモデルのフォールバックを考慮し、
    1リクエストで最大3レース分の分析をまとめて生成する。
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("[LLM Generator] GEMINI_API_KEY is not set. Skipping batch generation.")
        return

    # すでにテキストがあるものや、予測データがないものを除外
    races_to_process = []
    for rid in target_races:
        race = db.query(models.Race).filter(models.Race.id == rid).first()
        if not race or race.ai_analysis_text:
            continue
        
        preds_count = db.query(models.Prediction).filter(models.Prediction.race_id == rid).filter(models.Prediction.deviation_score.isnot(None)).count()
        if preds_count > 0:
            races_to_process.append(rid)

    if not races_to_process:
        print("[LLM Generator] No races require AI analysis generation.")
        return

    print(f"[LLM Generator] Starting batch generation for {len(races_to_process)} races.")

    chunk_size = 3
    chunks = [races_to_process[i:i + chunk_size] for i in range(0, len(races_to_process), chunk_size)]

    model_tiers = [
        "gemini-3-flash-preview",
        "gemini-3.1-flash-lite-preview",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite"
    ]
    
    # モデルごとのソフトリミット設定 (画像ダッシュボードの無料枠上限に基づく)
    model_limits = {
        "gemini-3-flash-preview": 19,           # 無料枠 RPD=20
        "gemini-3.1-flash-lite-preview": 480,   # 無料枠 RPD=500 
        "gemini-2.5-flash": 19,                 # 無料枠 RPD=20
        "gemini-2.5-flash-lite": 19             # 無料枠 RPD=20
    }
    
    CONSECUTIVE_ERROR_LIMIT = 3  # 連続エラーでフォールバックする閾値
    current_tier_idx = 0
    current_model_usage = 0
    consecutive_errors = 0  # 連続エラーカウンタ
    
    client = genai.Client(api_key=api_key)

    # whileループで管理し、フォールバック時に同じチャンクをリトライできるようにする
    chunk_idx = 0
    while chunk_idx < len(chunks):
        chunk = chunks[chunk_idx]
        current_model = model_tiers[current_tier_idx]
        current_limit = model_limits.get(current_model, 20)

        # モデル使用上限チェック
        if current_model_usage >= current_limit:
            print(f"[LLM Generator] Reached soft limit ({current_limit}) for {current_model}. Switching to next tier.")
            current_tier_idx += 1
            current_model_usage = 0
            consecutive_errors = 0
            
            if current_tier_idx >= len(model_tiers):
                print("[LLM Generator] ALERT: All fallback models have been exhausted for today! Stopping generation.")
                break
                
            current_model = model_tiers[current_tier_idx]
            current_limit = model_limits.get(current_model, 20)
            
        print(f"[LLM Generator] Processing chunk {chunk_idx + 1}/{len(chunks)} ({len(chunk)} races) using {current_model} ...")

        combined_prompt_data = ""
        for rid in chunk:
            combined_prompt_data += _get_race_prompt_data(db, rid) + "\n"

        chunk_hash = _get_race_hash(chunk[0])
        gen_random = random.Random(chunk_hash)
        dynamic_temperature = round(gen_random.uniform(0.75, 0.95), 2)

        master_prompt = f"""あなたは競馬専門紙の編集部員です。以下の{len(chunk)}つのレースそれぞれについて、レース展望記事を執筆してください。

━━━━━━━━━━━━━━━━━━━
■ 編集方針（全レース共通・絶対遵守）
━━━━━━━━━━━━━━━━━━━

【文体】
・口調は「〜である」「〜だろう」「〜といえる」「〜と見る」を基調にした、競馬新聞の予想コラムの文体で統一すること。
・「〜です」「〜ます」「〜でしょう」「〜してまいります」等の敬語・丁寧語は一切使用禁止。
・「〜と考える」「〜と判断する」も使用禁止（投資レポート調になるため）。
・一人称は使わない。「私は〜」「筆者は〜」等は禁止。

【禁止語彙】
・「リスクリワード」「ポートフォリオ」「ブルーチップ」「ボラティリティ」等の金融用語は一切使用禁止。
・「物理的」「蓋然性」「統計的に」「内包する」「示唆する」等の学術用語は、1記事中に合計2回以内に制限。言い換え（「距離ロスが増える」「可能性がある」「〜とみられる」等）を使うこと。
・サイトの説明やAIの自己言及（「このAIは〜」「データサイエンスの観点から〜」）は禁止。
・「砂塵の〜」「ドラマチックな〜」等のポエム的表現は禁止。
・「40年の経験から〜」等の架空の経歴・人物設定に基づく発言は禁止。

【記事構造ルール】
・各レースには固有の「記事構成」「分析の切り口」「結論の締め方」「文字数」「書き出し制約」が指定されている。それぞれ忠実に従うこと。
・全レースが同じ構成・同じ書き出しにならないように、指定された構成に厳密に従うこと。

【内容ルール】
・AI偏差値と1角ポジション指標は具体的な数値つきで引用すること。枠番（〇枠〇番）にも言及すること。
・数値の羅列ではなく、その数値が「何を意味するか」を競馬ファンが読んで納得できる言葉で解説すること。
・マークダウン記号（# ** など）やHTMLタグは一切使用禁止。プレーンテキストのみ。段落間は空白行1行。
・「こんにちは」「以下に分析を〜」等のメタ発言は不要。いきなり本文から書き始めること。

━━━━━━━━━━━━━━━━━━━
■ レースデータ
━━━━━━━━━━━━━━━━━━━
{combined_prompt_data}
"""

        try:
            response = client.models.generate_content(
                model=current_model,
                contents=master_prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=list[RaceAnalysis],
                    temperature=dynamic_temperature,
                )
            )
            
            if response and response.text:
                parsed_responses = json.loads(response.text)
                saved_count = 0
                for item in parsed_responses:
                    r_id = item.get("race_id")
                    text = item.get("analysis_text")
                    if r_id and text:
                        race = db.query(models.Race).filter(models.Race.id == r_id).first()
                        if race:
                            race.ai_analysis_text = text.strip()
                            saved_count += 1
                
                db.commit()
                print(f"[LLM Generator] Successfully saved {saved_count} analyses from this chunk.")
                current_model_usage += 1
                consecutive_errors = 0
                chunk_idx += 1  # 成功時のみ次のチャンクへ
                time.sleep(4.5)
                
            else:
                print(f"[LLM Generator] Empty response for chunk {chunk_idx + 1}")
                chunk_idx += 1  # 空レスポンスの場合も次へ

        except Exception as e:
            error_str = str(e)
            print(f"[LLM Generator] Error generating chunk with {current_model}: {error_str}")
            db.rollback()
            
            def _do_fallback():
                """フォールバック処理の共通ロジック。成功時True、全モデル枯渇時False"""
                nonlocal current_tier_idx, current_model_usage, consecutive_errors
                current_tier_idx += 1
                current_model_usage = 0
                consecutive_errors = 0
                if current_tier_idx >= len(model_tiers):
                    print("[LLM Generator] ALERT: All fallback models have been exhausted! Stopping generation.")
                    return False
                return True

            # 429 or quota → 即座にフォールバック（同じチャンクをリトライ）
            if "429" in error_str or "quota" in error_str.lower():
                print(f"[LLM Generator] Encountered rate limit/quota error for {current_model}. Falling back immediately.")
                if not _do_fallback():
                    break
                continue  # chunk_idxを進めず同じチャンクをリトライ
            
            # 503 or UNAVAILABLE → 連続エラーをカウントし、閾値超えでフォールバック
            consecutive_errors += 1
            if ("503" in error_str or "unavailable" in error_str.lower()) and consecutive_errors >= CONSECUTIVE_ERROR_LIMIT:
                print(f"[LLM Generator] {current_model} has failed {consecutive_errors} times consecutively (503/UNAVAILABLE). Falling back to next tier.")
                if not _do_fallback():
                    break
                continue  # chunk_idxを進めず同じチャンクをリトライ
            
            # その他のエラーは次のチャンクへ
            chunk_idx += 1
            time.sleep(5)

    print("[LLM Generator] Batch generation finished.")
    
def generate_and_save_race_analysis(db: Session, race_id: str):
    """Obsolete: Use generate_analyses_in_batches instead."""
    generate_analyses_in_batches(db, [race_id])

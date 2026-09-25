from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from dataclasses import replace
from datetime import date
from pathlib import Path
from typing import Iterable, List, Optional, Sequence

from . import brand_scenes as scenes
from .data_loader import (
    HorseVideoData,
    RaceVideoData,
    VenueVideoData,
    build_race_path,
    build_video_url,
    pick_featured_race,
    top_by_deviation,
)
from .motion import AudioCue, MotionScene, render_motion_scenes, resolve_motion_profile
from .video_package import VideoPackage, build_content_hash, build_rights_manifest_hash
from .visual_assets import (
    AudioAsset,
    VideoAsset,
    VisualAsset,
    audio_asset_metadata,
    resolve_audio_asset,
    resolve_sfx_assets,
    resolve_video_asset,
    resolve_visual_asset,
    video_asset_metadata,
    visual_asset_metadata,
)


PROJECT_ROOT = Path(__file__).resolve().parents[3]
# 動画に描くロゴ（sns_images と同じ透過PNG）
BRAND_LOGO_PATH = PROJECT_ROOT / "backend" / "fonts" / "new-logo.png"

# 見た目の版。content_hash に入るため、描き方を変えたら上げる。
DESIGN_SYSTEM = "uma_free_brand_v10_daily_compilation"

LONG_INTRO_SECONDS = 2.2
LONG_CHAPTER_SECONDS = 2.2
LONG_RACE_SCENE_SECONDS = 6.0
LONG_OUTRO_SECONDS = 3.0
# Shorts：最後のレースは締めまで15.5秒、それ以外のレースは12秒の型を収録数に合わせて縮める。
SHORT_SCENE_SECONDS = 15.5
SHORT_COMBINED_RACE_SECONDS = 12.0
SHORT_MAX_COMPILATION_SECONDS = 59.5
VIDEO_FPS = 30

RenderedVideo = VideoPackage


def _brand_logo_metadata() -> Optional[dict]:
    if not BRAND_LOGO_PATH.is_file():
        return None
    return {
        "type": "brand_logo",
        "path": str(BRAND_LOGO_PATH),
        "asset_id": BRAND_LOGO_PATH.relative_to(PROJECT_ROOT).as_posix(),
    }


def _brand_design_metadata() -> dict:
    """UMA-FREE が作った図柄（案内役の馬・4つの視点のアイコン・24場のコース図）。写真・音源とは別に記録する。"""
    return {
        "type": "brand_design",
        "assets": sorted(
            path.relative_to(PROJECT_ROOT).as_posix()
            for path in scenes.VIDEO_ASSET_DIR.glob("*.png")
        ),
        "course_shapes": scenes.COURSE_SHAPES_PATH.relative_to(PROJECT_ROOT).as_posix(),
    }


def _safe_filename(text: str) -> str:
    safe = "".join(ch if ch.isalnum() or ch in {"-", "_"} else "_" for ch in text)
    while "__" in safe:
        safe = safe.replace("__", "_")
    return safe.strip("_")[:80] or "video"


def _best_horse_for_race(race: RaceVideoData) -> Optional[HorseVideoData]:
    horses = top_by_deviation(race, 1)
    return horses[0] if horses else None


def _best_horse_for_venue(venue: VenueVideoData) -> tuple[Optional[RaceVideoData], Optional[HorseVideoData]]:
    featured_race = pick_featured_race(venue)
    return featured_race, _best_horse_for_race(featured_race) if featured_race else None


def _surfaces_label(races: Sequence[RaceVideoData]) -> str:
    """「芝・ダート」「ダート」など、章に出す馬場の並び。"""
    labels = []
    for race in races:
        text = str(race.course_type or "")
        label = "障害" if "障" in text else "ダート" if "ダ" in text else "芝" if "芝" in text else ""
        if label and label not in labels:
            labels.append(label)
    order = {"芝": 0, "ダート": 1, "障害": 2}
    return "・".join(sorted(labels, key=order.get))


def _chapter_scope(venue: VenueVideoData) -> str:
    """章の説明：「全12レース · 芝・ダート」。予測の対象外があれば「全12レース中10レースを収録」。"""
    surfaces = _surfaces_label(venue.races)
    total = len(venue.races) + len(venue.excluded_races)
    head = f"全{total}レース中{len(venue.races)}レースを収録" if venue.excluded_races else f"全{total}レース"
    return f"{head} · {surfaces}" if surfaces else head


def _day_surface(venues: Sequence[VenueVideoData]) -> str:
    """導入とサムネイルの写真：中央の開催がある日は芝、地方だけの日はダート（ホームの写真と同じ決め方）。"""
    return "turf" if any(venue.race_type == "中央" for venue in venues) else "dirt"


def _build_long_race_motion_scene(
    video_dir: Path,
    race: RaceVideoData,
    target_date: str,
    progress_index: int,
    progress_total: int,
    venue_index: int = 1,
) -> MotionScene:
    # 場面の画像の名前に会場の番号を入れる。会場の中の順番とR番号だけだと、
    # 会場をまたいで同じ名前になり、書き出す前に後の会場の絵で上書きされる。
    return scenes.build_long_race(
        video_dir,
        race,
        target_date=target_date,
        progress_index=progress_index,
        progress_total=progress_total,
        duration=LONG_RACE_SCENE_SECONDS,
        prefix=f"{venue_index:02d}_{progress_index:02d}_{race.race_number:02d}r",
    )


def _build_short_motion_scene(
    video_dir: Path,
    race: RaceVideoData,
    target_date: str,
    visual_asset: Optional[VisualAsset],
    video_asset: Optional[VideoAsset],
    *,
    race_index: int = 1,
    race_total: int = 1,
    branded: bool = True,
    include_cta: bool = True,
    duration_seconds: Optional[float] = None,
) -> MotionScene:
    duration = SHORT_SCENE_SECONDS if include_cta else (duration_seconds or SHORT_COMBINED_RACE_SECONDS)
    return scenes.build_short_race(
        video_dir,
        race,
        target_date=target_date,
        race_index=race_index,
        race_total=race_total,
        asset=visual_asset,
        video=video_asset,
        branded=branded,
        include_closing=include_cta,
        duration=duration,
    )


def _daily_short_intermediate_duration(race_count: int) -> float:
    if race_count <= 1:
        return 0.0
    available = SHORT_MAX_COMPILATION_SECONDS - SHORT_SCENE_SECONDS
    return min(SHORT_COMBINED_RACE_SECONDS, available / (race_count - 1))


def _add_bgm(
    ffmpeg: str,
    video_path: Path,
    output_path: Path,
    audio_asset: AudioAsset,
    duration_seconds: float,
    audio_cues: Sequence[AudioCue] = (),
) -> None:
    fade_in = min(0.6, max(0.1, duration_seconds * 0.1))
    fade_out = min(0.8, max(0.1, duration_seconds * 0.15))
    fade_out_start = max(fade_in, duration_seconds - fade_out)
    filter_parts = [
        "[1:a]loudnorm=I=-18:TP=-1.5:LRA=11,"
        "aresample=48000,"
        f"volume={audio_asset.volume:.4f},"
        f"afade=t=in:st=0:d={fade_in:.3f},"
        f"afade=t=out:st={fade_out_start:.3f}:d={fade_out:.3f},"
        f"atrim=0:{duration_seconds:.3f},asetpts=N/SR/TB[bgm]"
    ]
    cue_labels: list[str] = []
    cue_inputs: list[str] = []
    for index, cue in enumerate(audio_cues, start=2):
        cue_inputs.extend(["-i", str(cue.asset_path)])
        label = f"cue{index}"
        delay_ms = max(0, round(cue.start_seconds * 1000))
        filter_parts.append(
            f"[{index}:a]aresample=48000,volume={max(0.0, min(1.0, cue.volume)):.4f},"
            f"atrim=0:{max(0.05, cue.max_duration):.3f},"
            f"afade=t=out:st={max(0.02, cue.max_duration - 0.10):.3f}:d=0.10,"
            f"adelay={delay_ms}:all=1[{label}]"
        )
        cue_labels.append(f"[{label}]")
    if cue_labels:
        filter_parts.append(
            f"[bgm]{''.join(cue_labels)}amix=inputs={1 + len(cue_labels)}:"
            f"duration=first:normalize=0,alimiter=limit=0.891,"
            f"atrim=0:{duration_seconds:.3f}[mix]"
        )
        audio_map = "[mix]"
    else:
        audio_map = "[bgm]"
    command = [
        ffmpeg,
        "-y",
        "-i",
        str(video_path),
        "-stream_loop",
        "-1",
        "-i",
        str(audio_asset.path),
        *cue_inputs,
        "-filter_complex",
        ";".join(filter_parts),
        "-map",
        "0:v",
        "-map",
        audio_map,
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-t",
        f"{duration_seconds:.3f}",
        "-shortest",
        "-movflags",
        "+faststart",
        str(output_path),
    ]
    subprocess.run(command, check=True)


def render_motion_video(
    scenes: Sequence[MotionScene],
    output_path: Path,
    width: int,
    height: int,
    audio_asset: Optional[AudioAsset] = None,
) -> None:
    """Broadcast Editorialのレイヤーシーンを動画化し、既存BGMを付与する。"""

    ffmpeg = os.getenv("FFMPEG_BINARY") or shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError(
            "ffmpegが見つかりません。ローカル検証では --skip-video を使うか、ffmpegをインストールしてください。"
        )
    video_without_audio = output_path.with_suffix(".video.mp4") if audio_asset else output_path
    duration_seconds = render_motion_scenes(
        scenes,
        video_without_audio,
        width,
        height,
        VIDEO_FPS,
    )
    if audio_asset:
        timeline_cues: list[AudioCue] = []
        scene_offset = 0.0
        for scene in scenes:
            for cue in scene.audio_cues:
                timeline_cues.append(
                    AudioCue(
                        asset_path=cue.asset_path,
                        start_seconds=scene_offset + cue.start_seconds,
                        volume=cue.volume,
                        max_duration=cue.max_duration,
                        cue_type=cue.cue_type,
                    )
                )
            scene_offset += scene.duration_seconds
        _add_bgm(
            ffmpeg,
            video_without_audio,
            output_path,
            audio_asset,
            duration_seconds,
            audio_cues=timeline_cues,
        )
        try:
            video_without_audio.unlink()
        except OSError:
            pass


def _write_metadata(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _sentence_date_label(target_date: str) -> str:
    """概要欄の本文で使う日付表記（例: 2026年8月19日(水)）を返す。"""
    parsed = date.fromisoformat(target_date)
    weekday = "月火水木金土日"[parsed.weekday()]
    return f"{parsed.year}年{parsed.month}月{parsed.day}日({weekday})"


def _bullet_lines(heading: str, items: Sequence[str]) -> List[str]:
    """見出し付きの箇条書きを返す。項目が無ければ何も返さない。"""
    if not items:
        return []
    return ["", heading, *[f"・{item}" for item in items]]


def _title_date_parts(target_date: str) -> tuple[str, str]:
    parsed = date.fromisoformat(target_date)
    weekday = "月火水木金土日"[parsed.weekday()]
    return f"{parsed.month}/{parsed.day}({weekday})", f"{parsed.year}年"


# YouTubeのタイトル上限。
YOUTUBE_TITLE_MAX_LENGTH = 100


def _assemble_title(essential: Sequence[str], optional: Sequence[str]) -> str:
    """必須要素を先に確保し、残りは丸ごと入るものだけを採用する。

    単純に連結して末尾を切ると、上限ぴったりのところで重賞名が
    語の途中で切れて「スパーキングサマーカ」のような検索されない
    文字列になる。入らない要素は落として、残った要素は原形を保つ。
    """
    parts = [str(item).strip() for item in essential if str(item).strip()]
    title = "｜".join(parts)
    for item in optional:
        candidate = str(item).strip()
        if not candidate:
            continue
        merged = f"{title}｜{candidate}" if title else candidate
        if len(merged) > YOUTUBE_TITLE_MAX_LENGTH:
            continue
        title = merged
    return title[:YOUTUBE_TITLE_MAX_LENGTH].rstrip("｜・ ")


def _venue_label(venue_names: Sequence[str], limit: int = 2) -> str:
    """タイトルへ入れる会場名。多すぎる場合は先頭だけ挙げて「ほか」で締める。"""
    unique = list(dict.fromkeys(name for name in venue_names if name))
    if not unique:
        return ""
    if len(unique) <= limit:
        return "・".join(unique)
    return "・".join(unique[:limit]) + "ほか"


def _compilation_races(venues: Sequence[VenueVideoData]) -> List[RaceVideoData]:
    return [race for venue in venues for race in venue.races]


def _compilation_grade_races(venues: Sequence[VenueVideoData]) -> List[RaceVideoData]:
    return [race for race in _compilation_races(venues) if race.is_grade_race]


# YouTubeのタグはリスト全体で500文字までで、超えるとアップロードが
# invalidTags で失敗する。件数の上限は30件。
YOUTUBE_TAG_TOTAL_LIMIT = 500
YOUTUBE_TAG_COUNT_LIMIT = 30


def _dedupe_tags(
    tags: Iterable[str],
    limit: int = YOUTUBE_TAG_COUNT_LIMIT,
    total_char_limit: int = YOUTUBE_TAG_TOTAL_LIMIT,
) -> List[str]:
    """空文字と重複を除き、YouTubeの上限に収まるタグ列を返す。

    引数は優先度の高い順に渡すこと。文字数の予算を超えたタグは
    そこで打ち切らず読み飛ばすため、後ろにある短い汎用タグは残る。
    """
    seen: set[str] = set()
    result: List[str] = []
    used_chars = 0
    for tag in tags:
        normalized = str(tag or "").strip()
        if not normalized or normalized in seen:
            continue
        # 区切り文字ぶんを1文字として見積もる。
        cost = len(normalized) + (1 if result else 0)
        if used_chars + cost > total_char_limit:
            continue
        seen.add(normalized)
        result.append(normalized)
        used_chars += cost
        if len(result) >= min(limit, YOUTUBE_TAG_COUNT_LIMIT):
            break
    return result


def _grade_race_intent_tags(
    races: Sequence[RaceVideoData],
    limit: int = 2,
) -> List[str]:
    """重賞名と検索意図を組み合わせたタグを返す。

    「スパーキングサマーカップ 予想」のように、レース名と「予想」を
    合わせて検索されるため、名前単体だけでなく組み合わせも持たせる。
    """
    tags: List[str] = []
    for race in races[:limit]:
        name = race.display_name
        if not name:
            continue
        tags.extend([name, f"{name}予想", f"{name}AI予想"])
    return tags


def _venue_intent_tags(venue_names: Sequence[str], limit: int = 3) -> List[str]:
    """競馬場名の検索バリエーションを返す（川崎 / 川崎競馬 / 川崎競馬予想）。"""
    tags: List[str] = []
    for name in list(dict.fromkeys(n for n in venue_names if n))[:limit]:
        tags.extend([name, f"{name}競馬", f"{name}競馬予想"])
    return tags


def _date_tag(target_date: str) -> str:
    """日付での検索に当てるタグ（例: 8月19日競馬）を返す。"""
    try:
        parsed = date.fromisoformat(target_date)
    except (TypeError, ValueError):
        return ""
    return f"{parsed.month}月{parsed.day}日競馬"


def _race_condition_tags(races: Sequence[RaceVideoData], limit: int = 4) -> List[str]:
    """収録レースのコース条件を検索語に近い形（例: 芝1600m）でタグ化する。"""
    conditions: List[str] = []
    for race in races:
        if not race.course_type or not race.distance:
            continue
        conditions.append(f"{race.course_type}{race.distance}m")
    return _dedupe_tags(conditions, limit=limit)


def _grade_tags(races: Sequence[RaceVideoData]) -> List[str]:
    """重賞のグレード表記を検索されやすい形でタグ化する。"""
    grades: List[str] = []
    for race in races:
        grade = str(race.grade or "").strip()
        if grade:
            grades.append(grade)
    return _dedupe_tags(grades, limit=3)


def _race_type_scope(venues: Sequence[VenueVideoData]) -> str:
    types = {str(venue.race_type).strip() for venue in venues}
    if "中央" in types and "地方" in types:
        return "中央競馬・地方競馬"
    if "中央" in types:
        return "中央競馬"
    if "地方" in types:
        return "地方競馬"
    return "競馬"


def _daily_long_title(venues: Sequence[VenueVideoData], target_date: str) -> str:
    date_label, year_label = _title_date_parts(target_date)
    races = _compilation_races(venues)
    grade_names = "・".join(
        race.display_name for race in _compilation_grade_races(venues)[:2]
    )
    # 「{競馬場名} 予想」で検索されるため、収録会場をタイトルにも入れる。
    # 4場以上あるので上位2場＋「ほか」に留める。
    venue_label = _venue_label([venue.venue_name for venue in venues])
    return _assemble_title(
        [date_label, f"全{len(races)}レースAI分析"],
        [
            venue_label,
            grade_names,
            f"{_race_type_scope(venues)}予想",
            year_label,
        ],
    )


def _daily_short_title(races: Sequence[RaceVideoData], target_date: str) -> str:
    if not races:
        raise ValueError("Shortsの収録対象レースがありません")
    date_label, year_label = _title_date_parts(target_date)
    grade_races = [race for race in races if race.is_grade_race]
    # 収録会場は1〜3場に収まるため、日付の直後に置いて
    # 「{競馬場名} 予想」の検索に当てる。
    venue_label = _venue_label([race.venue_name for race in races], limit=3)
    essential = [date_label]
    if venue_label:
        essential.append(f"{venue_label} 注目{len(races)}レースAI分析")
    else:
        essential.append(f"注目{len(races)}レースAI分析")
    optional = []
    if grade_races:
        optional.append("・".join(race.display_name for race in grade_races[:2]))
    optional.extend([
        "AI競馬予想",
        f"{year_label} #Shorts",
    ])
    return _assemble_title(essential, optional)


def _format_chapter_timestamp(seconds: float) -> str:
    total_seconds = max(0, int(seconds))
    minutes, second = divmod(total_seconds, 60)
    hours, minute = divmod(minutes, 60)
    if hours:
        return f"{hours:02d}:{minute:02d}:{second:02d}"
    return f"{minute:02d}:{second:02d}"


# YouTubeがタイムスタンプをチャプターのリンクに変換する条件。
# 「先頭が00:00」「3件以上」「各チャプターが10秒以上」を
# すべて満たしたときだけリンク化され、1つでも欠けると
# 全チャプターがただの文字列として表示される。
YOUTUBE_MIN_CHAPTER_COUNT = 3
YOUTUBE_MIN_CHAPTER_SECONDS = 10.0


def _finalize_chapter_lines(
    entries: Sequence[tuple[float, str]],
    total_seconds: float,
) -> List[str]:
    """チャプター候補をYouTubeの要件に合わせて整形する。

    10秒に満たない区間は直前のチャプターへ統合する（見出しも連結するため、
    表示と中身がずれない）。統合しても要件を満たせない場合は空リストを返し、
    リンクにならないタイムスタンプを概要欄へ載せない。
    """
    if not entries:
        return []

    merged: List[list] = []
    for start, label in sorted(entries, key=lambda item: item[0]):
        text = str(label).strip()
        if not text:
            continue
        if merged and start - merged[-1][0] < YOUTUBE_MIN_CHAPTER_SECONDS:
            merged[-1][1] = f"{merged[-1][1]} / {text}"
        else:
            merged.append([float(start), text])

    # 最終チャプターも10秒以上必要。足りなければ1つ前へ畳む。
    while len(merged) > 1 and total_seconds - merged[-1][0] < YOUTUBE_MIN_CHAPTER_SECONDS:
        tail = merged.pop()
        merged[-1][1] = f"{merged[-1][1]} / {tail[1]}"

    if len(merged) < YOUTUBE_MIN_CHAPTER_COUNT or merged[0][0] > 0.5:
        return []
    merged[0][0] = 0.0
    return [
        f"{_format_chapter_timestamp(start)} {label}"
        for start, label in merged
    ]


def _daily_compilation_lead(
    venues: Sequence[VenueVideoData],
    target_date: str,
    short_races: Sequence[RaceVideoData] = (),
) -> str:
    """概要欄の冒頭に置く1文を組み立てる。

    YouTube検索の結果に出るのは概要欄の先頭部分なので、
    「日付」「開催場」「レース名」「予想」という
    実際に検索される語を自然な文章のまま先頭へ入れる。
    """
    if not target_date:
        return ""
    date_label = _sentence_date_label(target_date)
    scope = _race_type_scope(venues)
    if short_races:
        venue_names = "・".join(
            dict.fromkeys(race.venue_name for race in short_races)
        )
        lead = (
            f"{date_label}の{scope}から、{venue_names}の注目"
            f"{len(short_races)}レースを取り上げ、AI偏差値をもとにした予想データを紹介します。"
        )
        grade_races = [race for race in short_races if race.is_grade_race]
    else:
        venue_names = "・".join(venue.venue_name for venue in venues)
        lead = (
            f"{date_label}に行われる{scope} {venue_names}の全"
            f"{len(_compilation_races(venues))}レースについて、"
            "AI偏差値をもとにした予想データをレース順にまとめました。"
        )
        grade_races = _compilation_grade_races(venues)
    if grade_races:
        names = "、".join(race.display_name for race in grade_races[:3])
        lead += f"注目の重賞は{names}です。"
    return lead


def _daily_compilation_description(
    *,
    title: str,
    url: str,
    venues: Sequence[VenueVideoData],
    target_date: str = "",
    chapter_lines: Sequence[str] = (),
    short_races: Sequence[RaceVideoData] = (),
    additional_excluded_labels: Sequence[str] = (),
) -> str:
    grade_races = [
        race
        for race in (short_races or _compilation_grade_races(venues))
        if race.is_grade_race
    ]
    venue_items = [
        f"{venue.race_type}競馬 {venue.venue_name}（全{len(venue.races)}レース）"
        for venue in venues
    ]
    race_items = [
        f"{race.venue_name}{race.race_number}R {race.display_name}"
        for race in short_races
    ]
    lines = [
        url,
        "",
        _daily_compilation_lead(venues, target_date, short_races) or title,
        "",
        "【中央・地方競馬のAI分析をいつでも無料公開中】",
        "UMA-FREEでは、AI偏差値、過去対戦成績、位置取り予測、枠順傾向を登録不要で確認できます。",
        "本動画は、当日の競馬予想を検討する際の参考情報として、過去データに基づくAI分析をまとめたものです。",
    ]
    if race_items:
        lines.extend(_bullet_lines("収録レース", race_items))
    else:
        lines.extend(_bullet_lines("収録開催場", venue_items))
    # 収録レース一覧に重賞名が出ている場合、同じ名前をもう一度並べない。
    if grade_races and not race_items:
        lines.extend(
            _bullet_lines("収録重賞", [race.display_name for race in grade_races])
        )
    if chapter_lines:
        lines.extend(("", "チャプター", *chapter_lines))

    excluded_labels = [
        f"{venue.venue_name}{race.race_number}R {race.display_name}"
        for venue in venues
        for race in venue.excluded_races
    ] + list(additional_excluded_labels)
    if excluded_labels:
        lines.extend(
            (
                "",
                "※AI偏差値の算出対象外・データ未掲載のレースは収録していません: "
                + "、".join(excluded_labels),
            )
        )
    lines.extend(
        (
            "",
            "※本動画は過去データをもとにした参考情報です。結果を保証するものではありません。",
            "",
            "#競馬 #AI予想 #競馬予想 #中央競馬 #地方競馬 #UMA_FREE",
        )
    )
    return "\n".join(lines).strip()


def render_daily_long_video(
    venues: Sequence[VenueVideoData],
    target_date: str,
    output_dir: Path,
    skip_video: bool = False,
) -> RenderedVideo:
    """中央競馬の各場を先に、地方競馬を後にまとめた日次横動画を生成する。"""

    if not venues:
        raise ValueError("日次統合動画の対象開催場がありません")
    races = _compilation_races(venues)
    if not races:
        raise ValueError("日次統合動画の対象レースがありません")

    stable_id = "daily_all"
    video_dir = output_dir / "long" / stable_id
    video_dir.mkdir(parents=True, exist_ok=True)
    render_omissions: List[dict] = []
    filtered_venues: List[VenueVideoData] = []
    with tempfile.TemporaryDirectory(prefix="race-preflight-", dir=video_dir) as temp_dir:
        preflight_root = Path(temp_dir)
        for venue in venues:
            kept_races: List[RaceVideoData] = []
            failed_races: List[RaceVideoData] = []
            for race in venue.races:
                race_dir = preflight_root / _safe_filename(race.id)
                race_dir.mkdir(parents=True, exist_ok=True)
                try:
                    _build_long_race_motion_scene(
                        race_dir,
                        race,
                        target_date,
                        1,
                        1,
                    )
                except Exception as exc:
                    reason = f"描画失敗: {type(exc).__name__}: {str(exc)[:160]}"
                    failed_races.append(replace(race, omission_reason=reason))
                    render_omissions.append(
                        {
                            "race_id": race.id,
                            "venue_name": race.venue_name,
                            "race_number": race.race_number,
                            "race_name": race.display_name,
                            "grade": race.grade or "",
                            "reason": reason,
                            "category": "render_error",
                        }
                    )
                    continue
                kept_races.append(race)
            if kept_races:
                filtered_venues.append(
                    VenueVideoData(
                        venue_name=venue.venue_name,
                        race_type=venue.race_type,
                        races=kept_races,
                        excluded_races=[*venue.excluded_races, *failed_races],
                    )
                )
    venues = filtered_venues
    races = _compilation_races(venues)
    if not races:
        raise RuntimeError("全レースの事前描画に失敗したため、日次横動画を生成できません")
    utm_content = "daily_long_all"
    title = _daily_long_title(venues, target_date)
    combined_venue = VenueVideoData("日次統合", "統合", races)
    hero_race, _ = _best_horse_for_venue(combined_venue)
    if hero_race is None:
        raise RuntimeError("日次統合動画の代表レースを選定できません")

    visual_asset = resolve_visual_asset(
        target_date,
        hero_race.venue_name,
        hero_race.race_number,
        "wide",
        selection_key=stable_id,
        surface=_day_surface(venues),
    )
    motion_video_asset = resolve_video_asset(
        target_date,
        hero_race.venue_name,
        hero_race.race_number,
        "wide",
        selection_key=stable_id,
    )
    audio_asset = resolve_audio_asset(target_date, "venue_long", stable_id)
    sfx_assets = resolve_sfx_assets(target_date, "venue_long", stable_id)
    publish_block_reasons: List[str] = []
    asset_warnings: List[str] = []
    if visual_asset is None:
        asset_warnings.append("日次横動画用の横写真が見つからないため紺の背景を使用")
    if audio_asset is None:
        publish_block_reasons.append("日次横動画用BGMが見つかりません")

    scene_list: List[MotionScene] = [
        scenes.build_long_intro(
            video_dir,
            target_date=target_date,
            race_count=len(races),
            venue_names=[venue.venue_name for venue in venues],
            asset=visual_asset,
            video=motion_video_asset,
            duration=LONG_INTRO_SECONDS,
        )
    ]
    chapter_entries: List[tuple[float, str]] = [(0.0, "本日のAI分析まとめ")]
    elapsed_seconds = LONG_INTRO_SECONDS
    for venue_index, venue in enumerate(venues, start=1):
        featured_race = pick_featured_race(venue)
        if featured_race is None:
            continue
        chapter_entries.append(
            (
                elapsed_seconds,
                f"{venue.race_type}競馬 {venue.venue_name} 全{len(venue.races)}レース",
            )
        )
        scene_list.append(
            scenes.build_long_chapter(
                video_dir,
                venue_name=venue.venue_name,
                race_type=venue.race_type,
                chapter_index=venue_index,
                scope_text=_chapter_scope(venue),
                featured=featured_race,
                race_numbers=sorted(
                    [(race.race_number, True) for race in venue.races]
                    + [(race.race_number, False) for race in venue.excluded_races]
                ),
                duration=LONG_CHAPTER_SECONDS,
                prefix=f"chapter_{venue_index:02d}_{_safe_filename(venue.venue_name)}",
            )
        )
        elapsed_seconds += LONG_CHAPTER_SECONDS
        for progress_index, race in enumerate(venue.races, start=1):
            scene_list.append(
                _build_long_race_motion_scene(
                    video_dir,
                    race,
                    target_date,
                    progress_index,
                    len(venue.races),
                    venue_index=venue_index,
                )
            )
            elapsed_seconds += LONG_RACE_SCENE_SECONDS

    scene_list.append(scenes.build_long_outro(video_dir, duration=LONG_OUTRO_SECONDS))
    _attach_long_audio_cues(scene_list, sfx_assets)

    thumbnail = video_dir / "thumbnail.jpg"
    date_label, _ = _title_date_parts(target_date)
    thumbnail_text = f"{date_label} 全{len(races)}レース AI分析"
    scenes.draw_thumbnail(
        thumbnail,
        target_date=target_date,
        headline=f"全{len(races)}レース",
        accent="AI分析",
        featured=scenes.featured_for_thumbnail(races, hero_race),
        asset=visual_asset,
    )

    video_path: Optional[Path] = video_dir / f"{stable_id}.mp4"
    if skip_video:
        video_path = None
    else:
        render_motion_video(scene_list, video_path, *scenes.LONG_SIZE, audio_asset=audio_asset)

    url = build_video_url(target_date)
    total_duration_seconds = sum(scene.duration_seconds for scene in scene_list)
    chapter_lines = _finalize_chapter_lines(chapter_entries, total_duration_seconds)
    description = _daily_compilation_description(
        title=title,
        url=url,
        venues=venues,
        target_date=target_date,
        chapter_lines=chapter_lines,
    )
    tags = _dedupe_tags([
        "競馬",
        "AI予想",
        "競馬予想",
        "AI競馬予想",
        "中央競馬",
        "地方競馬",
        "UMA-FREE",
        *_grade_race_intent_tags(_compilation_grade_races(venues)),
        *_grade_tags(_compilation_grade_races(venues)),
        *_venue_intent_tags([venue.venue_name for venue in venues]),
        _date_tag(target_date),
        *_race_condition_tags(races),
    ])
    selected_assets = {
        "brand_logo": _brand_logo_metadata(),
        "brand_design": _brand_design_metadata(),
        "hero_image": visual_asset_metadata(visual_asset),
        "intro_videos": [video_asset_metadata(motion_video_asset)],
        "bgm": audio_asset_metadata(audio_asset),
        "sfx": [audio_asset_metadata(asset) for asset in sfx_assets.values()],
    }
    rights_manifest_hash = build_rights_manifest_hash(selected_assets)
    content_hash = build_content_hash(
        {
            "video_type": "daily_long",
            "stable_id": stable_id,
            "target_date": target_date,
            "title": title,
            "description": description,
            "tags": tags,
            "venue_order": [venue.venue_name for venue in venues],
            "race_ids": [race.id for race in races],
            "excluded_race_ids": [race.id for venue in venues for race in venue.excluded_races],
            "destination_url": url,
            "rights_manifest_hash": rights_manifest_hash,
            "design_system": DESIGN_SYSTEM,
            "motion_profile": resolve_motion_profile(),
        }
    )
    metadata_path = video_dir / "metadata.json"
    metadata = {
        "video_type": "daily_long",
        "stable_id": stable_id,
        "title": title,
        "description": description,
        "tags": tags,
        "target_date": target_date,
        "venue_name": "・".join(venue.venue_name for venue in venues),
        "venue_order": [
            {"race_type": venue.race_type, "venue_name": venue.venue_name}
            for venue in venues
        ],
        "race_ids": [race.id for race in races],
        "render_omissions": render_omissions,
        "aspect_ratio": "16:9",
        "url": url,
        "video_path": str(video_path) if video_path else None,
        "thumbnail_path": str(thumbnail),
        "thumbnail_text": thumbnail_text,
        "chapters": chapter_lines,
        "utm_content": utm_content,
        "rights_manifest_hash": rights_manifest_hash,
        "content_hash": content_hash,
        "thumbnail_required": True,
        "publishable": not publish_block_reasons,
        "publish_block_reasons": publish_block_reasons,
        "selected_assets": selected_assets,
        "asset_warnings": asset_warnings,
        "design_system": DESIGN_SYSTEM,
        "motion_profile": resolve_motion_profile(),
        "scene_count": len(scene_list),
        "race_scene_seconds": LONG_RACE_SCENE_SECONDS,
        "estimated_duration_seconds": total_duration_seconds,
    }
    _write_metadata(metadata_path, metadata)
    return RenderedVideo(
        video_type="daily_long",
        stable_id=stable_id,
        title=title,
        description=description,
        tags=tags,
        video_path=video_path,
        thumbnail_path=thumbnail,
        metadata_path=metadata_path,
        publish_offset_minutes=0,
        publishable=not publish_block_reasons,
        publish_block_reasons=publish_block_reasons,
        selected_assets=selected_assets,
        target_date=target_date,
        venue_name="・".join(venue.venue_name for venue in venues),
        race_ids=[race.id for race in races],
        aspect_ratio="16:9",
        destination_url=url,
        destination_path=build_race_path(target_date),
        utm_content=utm_content,
        race_number=hero_race.race_number,
        race_name=hero_race.display_name,
        rights_manifest_hash=rights_manifest_hash,
        content_hash=content_hash,
        thumbnail_required=True,
        estimated_duration_seconds=total_duration_seconds,
    )


def _append_audio_cue(
    scene: MotionScene,
    assets: dict[str, AudioAsset],
    cue_type: str,
    start_seconds: float,
    volume_scale: float = 1.0,
    max_duration: float = 0.8,
) -> None:
    asset = assets.get(cue_type)
    if asset is None:
        return
    scene.audio_cues.append(
        AudioCue(
            asset_path=asset.path,
            start_seconds=start_seconds,
            volume=max(0.0, min(1.0, asset.volume * volume_scale)),
            max_duration=max_duration,
            cue_type=cue_type,
        )
    )


def _attach_long_audio_cues(
    scenes_: Sequence[MotionScene],
    sfx_assets: dict[str, AudioAsset],
) -> None:
    if not scenes_:
        return
    _append_audio_cue(scenes_[0], sfx_assets, "whoosh", 0.02, 1.0, 0.9)
    for scene in scenes_[1:-1]:
        _append_audio_cue(scene, sfx_assets, "transition", 0.02, 0.52, 0.45)
        _append_audio_cue(scene, sfx_assets, "data_tick", 0.52, 0.44, 0.35)
    if len(scenes_) > 1:
        _append_audio_cue(scenes_[-1], sfx_assets, "cta", 0.22, 0.82, 0.9)


def _attach_short_audio_cues(
    scene: MotionScene,
    sfx_assets: dict[str, AudioAsset],
    *,
    include_cta: bool = True,
) -> None:
    """場面の切り替わり（表紙 → 上位5頭 → 位置取り → 締め）に合わせて鳴らす。"""
    scale = 1.0 if include_cta else scene.duration_seconds / SHORT_COMBINED_RACE_SECONDS
    _append_audio_cue(scene, sfx_assets, "whoosh", 0.02, 1.0, 0.9)
    _append_audio_cue(scene, sfx_assets, "score_reveal", 0.30 * scale, 0.86, 0.8)
    _append_audio_cue(scene, sfx_assets, "data_tick", 1.18 * scale, 0.62, 0.35)
    _append_audio_cue(scene, sfx_assets, "transition", 4.96 * scale, 0.64, 0.5)
    if include_cta:
        _append_audio_cue(scene, sfx_assets, "cta", 11.96, 0.92, 0.9)


def render_daily_short_video(
    races: Sequence[RaceVideoData],
    venues: Sequence[VenueVideoData],
    target_date: str,
    output_dir: Path,
    skip_video: bool = False,
) -> RenderedVideo:
    """当日の全重賞、重賞がない日は各場メインレースを1本のShortへまとめる。"""

    if not races:
        raise ValueError("日次Shortsの対象レースがありません")
    stable_id = "daily_short"
    video_dir = output_dir / "shorts" / stable_id
    video_dir.mkdir(parents=True, exist_ok=True)
    tiktok_video_dir = video_dir / "tiktok-clean"
    tiktok_video_dir.mkdir(parents=True, exist_ok=True)
    utm_content = "daily_short_compilation"
    render_omissions: List[dict] = []
    renderable_races: List[RaceVideoData] = []
    with tempfile.TemporaryDirectory(prefix="short-preflight-", dir=video_dir) as temp_dir:
        preflight_root = Path(temp_dir)
        for race in races:
            try:
                for branded in (True, False):
                    for include_cta in (False, True):
                        race_dir = (
                            preflight_root
                            / _safe_filename(race.id)
                            / ("brand" if branded else "clean")
                            / ("cta" if include_cta else "combined")
                        )
                        race_dir.mkdir(parents=True, exist_ok=True)
                        _build_short_motion_scene(
                            race_dir,
                            race,
                            target_date,
                            None,
                            None,
                            race_index=len(races),
                            race_total=len(races),
                            branded=branded,
                            include_cta=include_cta,
                            duration_seconds=(
                                None if include_cta else SHORT_COMBINED_RACE_SECONDS
                            ),
                        )
            except Exception as exc:
                render_omissions.append(
                    {
                        "race_id": race.id,
                        "venue_name": race.venue_name,
                        "race_number": race.race_number,
                        "race_name": race.display_name,
                        "grade": race.grade or "",
                        "reason": f"描画失敗: {type(exc).__name__}: {str(exc)[:160]}",
                        "category": "render_error",
                    }
                )
                continue
            renderable_races.append(race)
    races = renderable_races
    if not races:
        raise RuntimeError("全対象レースの事前描画に失敗したため、日次Shortsを生成できません")
    title = _daily_short_title(races, target_date)
    lead_race = races[0]
    audio_asset = resolve_audio_asset(target_date, "short", stable_id)
    sfx_assets = resolve_sfx_assets(target_date, "short", stable_id)
    publish_block_reasons: List[str] = []
    asset_warnings: List[str] = []
    if audio_asset is None:
        publish_block_reasons.append("日次Shorts用BGMが見つかりません")

    standard_scenes: List[MotionScene] = []
    tiktok_scenes: List[MotionScene] = []
    visual_assets: List[Optional[VisualAsset]] = []
    motion_video_assets: List[Optional[VideoAsset]] = []
    # Shortsプレイヤーはチャプターを解釈しないため、概要欄には出さず
    # メタデータ（収録順の記録）としてだけ保持する。
    chapter_lines: List[str] = []
    elapsed_seconds = 0.0
    intermediate_duration = _daily_short_intermediate_duration(len(races))
    for race_index, race in enumerate(races, start=1):
        race_key = f"{stable_id}_{race.id}"
        visual_asset = resolve_visual_asset(
            target_date,
            race.venue_name,
            race.race_number,
            "vertical",
            selection_key=race_key,
            surface=scenes.surface_key(race.course_type),
        )
        motion_video_asset = resolve_video_asset(
            target_date,
            race.venue_name,
            race.race_number,
            "vertical",
            selection_key=race_key,
        )
        visual_assets.append(visual_asset)
        motion_video_assets.append(motion_video_asset)
        if visual_asset is None:
            asset_warnings.append(
                f"{race.venue_name}{race.race_number}Rは紺の背景を使用"
            )
        include_cta = race_index == len(races)
        chapter_lines.append(
            f"{_format_chapter_timestamp(elapsed_seconds)} "
            f"{race.venue_name}{race.race_number}R {race.display_name}"
        )
        for branded, root, bucket in (
            (True, video_dir, standard_scenes),
            (False, tiktok_video_dir, tiktok_scenes),
        ):
            scene_dir = root if race_index == 1 else root / f"race_{race_index:02d}"
            scene_dir.mkdir(parents=True, exist_ok=True)
            scene = _build_short_motion_scene(
                scene_dir,
                race,
                target_date,
                visual_asset,
                motion_video_asset,
                race_index=race_index,
                race_total=len(races),
                branded=branded,
                include_cta=include_cta,
                duration_seconds=intermediate_duration if not include_cta else None,
            )
            _attach_short_audio_cues(scene, sfx_assets, include_cta=include_cta)
            bucket.append(scene)
        elapsed_seconds += standard_scenes[-1].duration_seconds

    total_duration_seconds = sum(scene.duration_seconds for scene in standard_scenes)
    if total_duration_seconds > SHORT_MAX_COMPILATION_SECONDS + 0.01:
        raise RuntimeError(
            "日次Shortsが59.5秒を超えています: "
            f"{total_duration_seconds:.3f}秒"
        )

    thumbnail = video_dir / "thumbnail.jpg"
    grade_races = [race for race in races if race.is_grade_race]
    scenes.draw_thumbnail(
        thumbnail,
        target_date=target_date,
        headline=f"重賞{len(grade_races)}レース" if grade_races else f"注目{len(races)}レース",
        accent="AI分析",
        featured=scenes.featured_for_thumbnail(races, lead_race),
        asset=resolve_visual_asset(
            target_date,
            lead_race.venue_name,
            lead_race.race_number,
            "wide",
            selection_key=stable_id,
            surface=scenes.surface_key(lead_race.course_type),
        ),
    )

    video_path: Optional[Path] = video_dir / f"{stable_id}.mp4"
    tiktok_video_path: Optional[Path] = tiktok_video_dir / f"{stable_id}_clean.mp4"
    if skip_video:
        video_path = None
        tiktok_video_path = None
    else:
        render_motion_video(standard_scenes, video_path, *scenes.SHORT_SIZE, audio_asset=audio_asset)
        render_motion_video(tiktok_scenes, tiktok_video_path, *scenes.SHORT_SIZE, audio_asset=audio_asset)

    url = build_video_url(target_date)
    description = _daily_compilation_description(
        title=title,
        url=url,
        venues=venues,
        target_date=target_date,
        short_races=races,
        additional_excluded_labels=[
            f"{item['venue_name']}{item['race_number']}R {item['race_name']}"
            for item in render_omissions
        ],
    )
    tags = _dedupe_tags([
        "競馬",
        "AI予想",
        "競馬予想",
        "AI競馬予想",
        "Shorts",
        "UMA-FREE",
        *_grade_race_intent_tags([race for race in races if race.is_grade_race]),
        *_grade_tags([race for race in races if race.is_grade_race]),
        *_venue_intent_tags([race.venue_name for race in races]),
        _date_tag(target_date),
        *_race_condition_tags(races),
    ])
    selected_assets = {
        "brand_logo": _brand_logo_metadata(),
        "brand_design": _brand_design_metadata(),
        "race_images": [visual_asset_metadata(asset) for asset in visual_assets],
        "background_videos": [video_asset_metadata(asset) for asset in motion_video_assets],
        "bgm": audio_asset_metadata(audio_asset),
        "sfx": [audio_asset_metadata(asset) for asset in sfx_assets.values()],
    }
    featured_races = [
        {
            "race_id": race.id,
            "venue_name": race.venue_name,
            "race_number": race.race_number,
            "race_name": race.display_name,
            "grade": race.grade or "",
            "destination_path": build_race_path(target_date),
        }
        for race in races
    ]
    rights_manifest_hash = build_rights_manifest_hash(selected_assets)
    content_hash = build_content_hash(
        {
            "video_type": "short",
            "stable_id": stable_id,
            "target_date": target_date,
            "title": title,
            "description": description,
            "tags": tags,
            "race_ids": [race.id for race in races],
            "render_omissions": render_omissions,
            "destination_url": url,
            "rights_manifest_hash": rights_manifest_hash,
            "design_system": DESIGN_SYSTEM,
            "motion_profile": resolve_motion_profile(),
        }
    )
    metadata_path = video_dir / "metadata.json"
    compilation_label = (
        f"重賞{len(grade_races)}レースまとめ"
        if grade_races
        else f"各競馬場メイン{len(races)}レースまとめ"
    )
    metadata = {
        "video_type": "short",
        "stable_id": stable_id,
        "title": title,
        "description": description,
        "tags": tags,
        "target_date": target_date,
        "venue_name": lead_race.venue_name,
        "race_ids": [race.id for race in races],
        "render_omissions": render_omissions,
        "featured_races": featured_races,
        "aspect_ratio": "9:16",
        "url": url,
        "video_path": str(video_path) if video_path else None,
        "variant_video_paths": {
            "standard": str(video_path) if video_path else None,
            "tiktok_clean": str(tiktok_video_path) if tiktok_video_path else None,
        },
        "thumbnail_path": str(thumbnail),
        "vertical_cover_path": str(video_dir / "000_intro.png"),
        "destination_path": build_race_path(target_date),
        "race_number": lead_race.race_number,
        "race_name": compilation_label,
        "utm_content": utm_content,
        "chapters": chapter_lines,
        "rights_manifest_hash": rights_manifest_hash,
        "content_hash": content_hash,
        "thumbnail_required": False,
        "publish_order": 1,
        "publishable": not publish_block_reasons,
        "publish_block_reasons": publish_block_reasons,
        "selected_assets": selected_assets,
        "asset_warnings": asset_warnings,
        "design_system": DESIGN_SYSTEM,
        "motion_profile": resolve_motion_profile(),
        "scene_count": len(standard_scenes),
        "estimated_duration_seconds": total_duration_seconds,
    }
    _write_metadata(metadata_path, metadata)
    return RenderedVideo(
        video_type="short",
        stable_id=stable_id,
        title=title,
        description=description,
        tags=tags,
        video_path=video_path,
        thumbnail_path=thumbnail,
        metadata_path=metadata_path,
        publish_offset_minutes=0,
        publishable=not publish_block_reasons,
        publish_block_reasons=publish_block_reasons,
        selected_assets=selected_assets,
        target_date=target_date,
        venue_name=lead_race.venue_name,
        race_ids=[race.id for race in races],
        aspect_ratio="9:16",
        destination_url=url,
        destination_path=build_race_path(target_date),
        utm_content=utm_content,
        race_number=lead_race.race_number,
        race_name=compilation_label,
        featured_races=featured_races,
        vertical_cover_path=video_dir / "000_intro.png",
        variant_video_paths={
            **({"standard": video_path} if video_path else {}),
            **({"tiktok_clean": tiktok_video_path} if tiktok_video_path else {}),
        },
        rights_manifest_hash=rights_manifest_hash,
        content_hash=content_hash,
        thumbnail_required=False,
        estimated_duration_seconds=total_duration_seconds,
    )

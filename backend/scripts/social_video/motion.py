from __future__ import annotations

import os
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal, Optional, Sequence


MotionProfile = Literal["standard", "reduced", "static"]
EasingName = Literal["ease_out", "ease_in", "linear"]
VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v", ".webm"}


@dataclass(frozen=True)
class MotionLayer:
    """FFmpegで時間差合成する透過PNGレイヤー。"""

    image_path: Path
    x: int
    y: int
    start_seconds: float
    end_seconds: float
    enter_duration: float = 0.24
    exit_duration: float = 0.0
    start_x: Optional[int] = None
    start_y: Optional[int] = None
    end_x: Optional[int] = None
    end_y: Optional[int] = None
    easing: EasingName = "ease_out"
    z_index: int = 0


@dataclass(frozen=True)
class AudioCue:
    """完成動画のタイムライン上で鳴らす短い効果音。"""

    asset_path: Path
    start_seconds: float
    volume: float = 0.16
    max_duration: float = 1.0
    cue_type: str = ""


@dataclass
class MotionScene:
    """背景と透過レイヤーで構成する一つの映像シーン。"""

    background_path: Path
    duration_seconds: float
    preview_path: Path
    layers: list[MotionLayer] = field(default_factory=list)
    audio_cues: list[AudioCue] = field(default_factory=list)
    scene_id: str = ""


def resolve_motion_profile() -> MotionProfile:
    profile = os.getenv("SOCIAL_VIDEO_MOTION_PROFILE", "standard").strip().lower()
    if profile not in {"standard", "reduced", "static"}:
        raise ValueError(
            "SOCIAL_VIDEO_MOTION_PROFILEはstandard、reduced、staticのいずれかを指定してください"
        )
    return profile  # type: ignore[return-value]


def _escaped_expression(expression: str) -> str:
    return expression.replace(",", r"\,")


def _position_expression(
    start_value: int,
    end_value: int,
    start_seconds: float,
    duration: float,
    easing: EasingName,
) -> str:
    if start_value == end_value or duration <= 0:
        return str(end_value)
    progress = f"max(0,min(1,(t-{start_seconds:.3f})/{duration:.3f}))"
    if easing == "ease_out":
        eased = f"(1-pow(1-({progress}),2))"
    elif easing == "ease_in":
        eased = f"pow(({progress}),2)"
    else:
        eased = progress
    return _escaped_expression(f"{start_value}+({end_value-start_value})*({eased})")


def _scene_input_args(path: Path) -> list[str]:
    if path.suffix.lower() in VIDEO_EXTENSIONS:
        return ["-stream_loop", "-1", "-i", str(path)]
    return ["-loop", "1", "-i", str(path)]


def _render_static_scene(
    ffmpeg: str,
    scene: MotionScene,
    output_path: Path,
    width: int,
    height: int,
    fps: int,
) -> None:
    command = [
        ffmpeg,
        "-y",
        "-loop",
        "1",
        "-i",
        str(scene.preview_path),
        "-vf",
        (
            f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
            f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,"
            f"fps={fps},format=yuv420p"
        ),
        "-t",
        f"{scene.duration_seconds:.3f}",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(output_path),
    ]
    subprocess.run(command, check=True)


def render_motion_scene(
    ffmpeg: str,
    scene: MotionScene,
    output_path: Path,
    width: int,
    height: int,
    fps: int,
    profile: Optional[MotionProfile] = None,
) -> None:
    """一つのMotionSceneをH.264無音クリップへ変換する。"""

    active_profile = profile or resolve_motion_profile()
    if active_profile == "static" or not scene.layers:
        _render_static_scene(ffmpeg, scene, output_path, width, height, fps)
        return

    input_args = _scene_input_args(scene.background_path)
    ordered_layers = sorted(scene.layers, key=lambda layer: (layer.z_index, layer.start_seconds))
    for layer in ordered_layers:
        input_args.extend(["-loop", "1", "-i", str(layer.image_path)])

    background_filter = (
        f"[0:v]scale={width}:{height}:force_original_aspect_ratio=increase,"
        f"crop={width}:{height},fps={fps},settb=AVTB,setpts=PTS-STARTPTS,"
        "format=rgba[base]"
    )
    filter_parts = [background_filter]
    previous = "[base]"
    for index, layer in enumerate(ordered_layers, start=1):
        source_label = f"[layer{index}]"
        enter_duration = 0.12 if active_profile == "reduced" else layer.enter_duration
        layer_filters = [f"[{index}:v]format=rgba,settb=AVTB,setpts=PTS-STARTPTS"]
        if enter_duration > 0:
            layer_filters.append(
                f"fade=t=in:st={layer.start_seconds:.3f}:d={enter_duration:.3f}:alpha=1"
            )
        if layer.exit_duration > 0:
            fade_start = max(layer.start_seconds, layer.end_seconds - layer.exit_duration)
            layer_filters.append(
                f"fade=t=out:st={fade_start:.3f}:d={layer.exit_duration:.3f}:alpha=1"
            )
        filter_parts.append(",".join(layer_filters) + source_label)

        if active_profile == "reduced":
            x_expression = str(layer.end_x if layer.end_x is not None else layer.x)
            y_expression = str(layer.end_y if layer.end_y is not None else layer.y)
        else:
            start_x = layer.start_x if layer.start_x is not None else layer.x
            start_y = layer.start_y if layer.start_y is not None else layer.y
            end_x = layer.end_x if layer.end_x is not None else layer.x
            end_y = layer.end_y if layer.end_y is not None else layer.y
            x_expression = _position_expression(
                start_x,
                end_x,
                layer.start_seconds,
                enter_duration,
                layer.easing,
            )
            y_expression = _position_expression(
                start_y,
                end_y,
                layer.start_seconds,
                enter_duration,
                layer.easing,
            )
        output_label = f"[composite{index}]"
        # 終了時刻を排他的にする。between()は両端を含むため、
        # 前レイヤーのendと次レイヤーのstartが同じ境界フレームで重なる。
        enable = _escaped_expression(
            f"gte(t,{layer.start_seconds:.3f})*lt(t,{layer.end_seconds:.3f})"
        )
        filter_parts.append(
            f"{previous}{source_label}overlay=x='{x_expression}':y='{y_expression}':"
            f"enable='{enable}':format=auto{output_label}"
        )
        previous = output_label

    filter_parts.append(f"{previous}format=yuv420p[outv]")
    command = [
        ffmpeg,
        "-y",
        *input_args,
        "-filter_complex",
        ";".join(filter_parts),
        "-map",
        "[outv]",
        "-t",
        f"{scene.duration_seconds:.3f}",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-r",
        str(fps),
        "-movflags",
        "+faststart",
        str(output_path),
    ]
    subprocess.run(command, check=True)


def _write_clip_manifest(clip_paths: Sequence[Path], manifest_path: Path) -> None:
    lines: list[str] = []
    for path in clip_paths:
        escaped = str(path.resolve()).replace("\\", "/").replace("'", "'\\''")
        lines.append(f"file '{escaped}'")
    manifest_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def render_motion_scenes(
    scenes: Sequence[MotionScene],
    output_path: Path,
    width: int,
    height: int,
    fps: int,
) -> float:
    """シーンを個別レンダリングし、再エンコードせず一つの動画へ連結する。"""

    if not scenes:
        raise ValueError("動画化するMotionSceneがありません")
    ffmpeg = os.getenv("FFMPEG_BINARY") or shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError(
            "ffmpegが見つかりません。ローカル検証では--skip-videoを使うか、ffmpegをインストールしてください。"
        )
    profile = resolve_motion_profile()
    motion_dir = output_path.parent / f".{output_path.stem}_motion"
    if motion_dir.exists():
        shutil.rmtree(motion_dir)
    motion_dir.mkdir(parents=True, exist_ok=True)
    try:
        clip_paths: list[Path] = []
        for index, scene in enumerate(scenes):
            clip_path = motion_dir / f"scene_{index:03d}.mp4"
            render_motion_scene(
                ffmpeg,
                scene,
                clip_path,
                width,
                height,
                fps,
                profile=profile,
            )
            clip_paths.append(clip_path)
        manifest_path = motion_dir / "clips.txt"
        _write_clip_manifest(clip_paths, manifest_path)
        subprocess.run(
            [
                ffmpeg,
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(manifest_path),
                "-c",
                "copy",
                "-movflags",
                "+faststart",
                str(output_path),
            ],
            check=True,
        )
    finally:
        shutil.rmtree(motion_dir, ignore_errors=True)
    return sum(max(0.0, scene.duration_seconds) for scene in scenes)

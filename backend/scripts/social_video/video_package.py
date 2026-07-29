from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, List, Mapping, Optional


def build_content_hash(payload: Mapping[str, Any]) -> str:
    """パスや生成時刻に依存しない動画内容のハッシュを作る。"""
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def build_rights_manifest_hash(selected_assets: Mapping[str, Any]) -> str:
    return build_content_hash({"selected_assets": selected_assets})


@dataclass
class VideoPackage:
    """YouTube以外の投稿先でも再利用できる動画成果物の共通契約。"""

    video_type: str
    stable_id: str
    title: str
    description: str
    tags: List[str]
    video_path: Optional[Path]
    thumbnail_path: Path
    metadata_path: Path
    publish_offset_minutes: int
    publishable: bool = True
    publish_block_reasons: List[str] = field(default_factory=list)
    selected_assets: dict = field(default_factory=dict)
    target_date: str = ""
    venue_name: str = ""
    race_ids: List[str] = field(default_factory=list)
    aspect_ratio: str = "16:9"
    destination_url: str = ""
    destination_path: str = ""
    utm_content: str = ""
    race_number: int = 0
    race_name: str = ""
    vertical_cover_path: Optional[Path] = None
    variant_video_paths: dict[str, Path] = field(default_factory=dict)
    rights_manifest_hash: str = ""
    content_hash: str = ""
    thumbnail_required: bool = True

    def publication_metadata(self) -> dict:
        return {
            "target_date": self.target_date,
            "venue_name": self.venue_name,
            "race_ids": self.race_ids,
            "aspect_ratio": self.aspect_ratio,
            "destination_url": self.destination_url,
            "destination_path": self.destination_path,
            "utm_content": self.utm_content,
            "race_number": self.race_number,
            "race_name": self.race_name,
            "vertical_cover_path": str(self.vertical_cover_path) if self.vertical_cover_path else None,
            "variant_video_paths": {
                name: str(path)
                for name, path in sorted(self.variant_video_paths.items())
            },
            "rights_manifest_hash": self.rights_manifest_hash,
            "thumbnail_required": self.thumbnail_required,
        }

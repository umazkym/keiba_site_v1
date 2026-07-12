from __future__ import annotations

import hashlib
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional


JST = timezone(timedelta(hours=9))


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _ensure_backend_path() -> None:
    backend_dir = _project_root() / "backend"
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))


def make_registry_key(target_date: str, video_type: str, stable_id: str) -> str:
    return f"youtube_video::{target_date}::{video_type}::{stable_id}"


def make_content_hash(registry_key: str) -> str:
    return hashlib.sha256(registry_key.encode("utf-8")).hexdigest()


class VideoPostRegistry:
    def __init__(self, enabled: bool = True) -> None:
        self.enabled = enabled and bool(os.getenv("DATABASE_URL"))
        self._models = None
        self._session_local = None
        if self.enabled:
            self._load_db()

    def _load_db(self) -> None:
        try:
            _ensure_backend_path()
            from database import models  # type: ignore
            from database.database import SessionLocal  # type: ignore

            self._models = models
            self._session_local = SessionLocal
        except Exception as exc:
            print(f"警告: 動画投稿レジストリのDB接続初期化に失敗しました: {exc}")
            self.enabled = False

    def is_posted(self, registry_key: str, target_date: str) -> bool:
        if not self.enabled or self._models is None or self._session_local is None:
            return False
        db = self._session_local()
        try:
            content_hash = make_content_hash(registry_key)
            existing = db.query(self._models.SnsPost).filter(
                self._models.SnsPost.content_hash == content_hash,
                self._models.SnsPost.target_date == target_date,
            ).first()
            return bool(existing)
        finally:
            db.close()

    def record(self, registry_key: str, target_date: str, post_type: str, video_id: Optional[str]) -> None:
        if not self.enabled or self._models is None or self._session_local is None:
            print("動画投稿レジストリは無効です。投稿記録をスキップします。")
            return
        db = self._session_local()
        try:
            content_hash = make_content_hash(registry_key)
            existing = db.query(self._models.SnsPost).filter(
                self._models.SnsPost.content_hash == content_hash,
                self._models.SnsPost.target_date == target_date,
            ).first()
            stored_id = f"youtube:{video_id}" if video_id else None
            if existing:
                if stored_id and not existing.tweet_id:
                    existing.tweet_id = stored_id
                existing.post_type = post_type
                db.commit()
                return
            db.add(
                self._models.SnsPost(
                    content_hash=content_hash,
                    post_type=post_type,
                    posted_at=datetime.now(JST),
                    target_date=target_date,
                    tweet_id=stored_id,
                )
            )
            db.commit()
        except Exception as exc:
            db.rollback()
            raise RuntimeError(f"動画投稿記録の保存に失敗しました: {exc}") from exc
        finally:
            db.close()


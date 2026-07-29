from __future__ import annotations

import hashlib
import os
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


JST = timezone(timedelta(hours=9))
TERMINAL_PUBLICATION_STATUSES = {
    "private_review",
    "scheduled",
    "draft",
    "processing",
    "published",
}


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _ensure_backend_path() -> None:
    backend_dir = _project_root() / "backend"
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))


def _target_date_value(value: str | date) -> date:
    return value if isinstance(value, date) else date.fromisoformat(value)


def make_registry_key(target_date: str, video_type: str, stable_id: str) -> str:
    return f"youtube_video::{target_date}::{video_type}::{stable_id}"


def make_content_hash(registry_key: str) -> str:
    """旧SnsPost互換用のキーhash。動画内容hashには使用しない。"""
    return hashlib.sha256(registry_key.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class PublicationRecord:
    platform: str
    target_date: str
    video_type: str
    stable_id: str
    status: str
    content_hash: str
    remote_video_id: Optional[str]
    scheduled_at: Optional[datetime]
    attempt_count: int
    last_error: Optional[str]
    metadata: Dict[str, Any]

    @property
    def is_terminal(self) -> bool:
        return self.status in TERMINAL_PUBLICATION_STATUSES


class VideoPostRegistry:
    """動画投稿を投稿先・動画ID単位で再開可能にするDBレジストリ。"""

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
            from database.database import Base, SessionLocal, engine  # type: ignore

            Base.metadata.create_all(bind=engine, tables=[models.VideoPublication.__table__], checkfirst=True)
            self._models = models
            self._session_local = SessionLocal
        except Exception as exc:
            print(f"警告: 動画投稿レジストリのDB接続初期化に失敗しました: {exc}")
            self.enabled = False

    def _require_db(self) -> None:
        if not self.enabled or self._models is None or self._session_local is None:
            raise RuntimeError("動画投稿レジストリが利用できません。重複防止のため投稿を中止します。")

    @staticmethod
    def _to_record(row: Any) -> PublicationRecord:
        return PublicationRecord(
            platform=str(row.platform),
            target_date=row.target_date.isoformat(),
            video_type=str(row.video_type),
            stable_id=str(row.stable_id),
            status=str(row.status),
            content_hash=str(row.content_hash),
            remote_video_id=str(row.remote_video_id) if row.remote_video_id else None,
            scheduled_at=row.scheduled_at,
            attempt_count=int(row.attempt_count or 0),
            last_error=str(row.last_error) if row.last_error else None,
            metadata=dict(row.metadata_json or {}),
        )

    def get(
        self,
        target_date: str,
        video_type: str,
        stable_id: str,
        platform: str = "youtube",
    ) -> Optional[PublicationRecord]:
        self._require_db()
        db = self._session_local()
        try:
            row = db.query(self._models.VideoPublication).filter(
                self._models.VideoPublication.platform == platform,
                self._models.VideoPublication.target_date == _target_date_value(target_date),
                self._models.VideoPublication.video_type == video_type,
                self._models.VideoPublication.stable_id == stable_id,
            ).first()
            return self._to_record(row) if row else None
        finally:
            db.close()

    def list_recent(
        self,
        days: int = 7,
        statuses: Optional[Iterable[str]] = None,
        platform: str = "youtube",
    ) -> List[PublicationRecord]:
        self._require_db()
        db = self._session_local()
        try:
            earliest_date = datetime.now(JST).date() - timedelta(days=max(0, days))
            query = db.query(self._models.VideoPublication).filter(
                self._models.VideoPublication.platform == platform,
                self._models.VideoPublication.target_date >= earliest_date,
            )
            normalized_statuses = [str(status) for status in statuses or [] if str(status)]
            if normalized_statuses:
                query = query.filter(self._models.VideoPublication.status.in_(normalized_statuses))
            rows = query.order_by(
                self._models.VideoPublication.target_date,
                self._models.VideoPublication.video_type,
                self._models.VideoPublication.stable_id,
            ).all()
            return [self._to_record(row) for row in rows]
        finally:
            db.close()

    def reserve(
        self,
        target_date: str,
        video_type: str,
        stable_id: str,
        content_hash: str,
        metadata: Dict[str, Any],
        platform: str = "youtube",
    ) -> PublicationRecord:
        self._require_db()
        db = self._session_local()
        try:
            row = db.query(self._models.VideoPublication).filter(
                self._models.VideoPublication.platform == platform,
                self._models.VideoPublication.target_date == _target_date_value(target_date),
                self._models.VideoPublication.video_type == video_type,
                self._models.VideoPublication.stable_id == stable_id,
            ).first()
            if row:
                if row.content_hash != content_hash:
                    raise RuntimeError(
                        "同一動画キーに異なる内容が検出されました。"
                        f" target_date={target_date} video_type={video_type} stable_id={stable_id}"
                    )
                row.attempt_count = int(row.attempt_count or 0) + 1
                row.last_error = None
                row.metadata_json = {**dict(row.metadata_json or {}), **metadata}
            else:
                row = self._models.VideoPublication(
                    platform=platform,
                    target_date=_target_date_value(target_date),
                    video_type=video_type,
                    stable_id=stable_id,
                    status="planned",
                    content_hash=content_hash,
                    attempt_count=1,
                    metadata_json=metadata,
                )
                db.add(row)
            db.commit()
            db.refresh(row)
            return self._to_record(row)
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def transition(
        self,
        target_date: str,
        video_type: str,
        stable_id: str,
        status: str,
        *,
        remote_video_id: Optional[str] = None,
        scheduled_at: Optional[datetime] = None,
        clear_scheduled_at: bool = False,
        metadata: Optional[Dict[str, Any]] = None,
        platform: str = "youtube",
    ) -> PublicationRecord:
        self._require_db()
        db = self._session_local()
        try:
            row = db.query(self._models.VideoPublication).filter(
                self._models.VideoPublication.platform == platform,
                self._models.VideoPublication.target_date == _target_date_value(target_date),
                self._models.VideoPublication.video_type == video_type,
                self._models.VideoPublication.stable_id == stable_id,
            ).first()
            if row is None:
                raise RuntimeError(f"投稿状態の予約レコードがありません: {target_date} {video_type} {stable_id}")
            row.status = status
            if remote_video_id:
                row.remote_video_id = remote_video_id
            if clear_scheduled_at:
                row.scheduled_at = None
            elif scheduled_at is not None:
                row.scheduled_at = scheduled_at
            if metadata:
                row.metadata_json = {**dict(row.metadata_json or {}), **metadata}
            row.last_error = None
            db.commit()
            db.refresh(row)
            return self._to_record(row)
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def record_error(
        self,
        target_date: str,
        video_type: str,
        stable_id: str,
        error: str,
        platform: str = "youtube",
    ) -> None:
        self._require_db()
        db = self._session_local()
        try:
            row = db.query(self._models.VideoPublication).filter(
                self._models.VideoPublication.platform == platform,
                self._models.VideoPublication.target_date == _target_date_value(target_date),
                self._models.VideoPublication.video_type == video_type,
                self._models.VideoPublication.stable_id == stable_id,
            ).first()
            if row is None:
                raise RuntimeError(f"投稿エラーの保存先がありません: {target_date} {video_type} {stable_id}")
            row.last_error = error[:2000]
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    # 旧SNSレジストリを参照する既存コード向けの互換API。
    def is_posted(self, registry_key: str, target_date: str) -> bool:
        if not self.enabled or self._models is None or self._session_local is None:
            return False
        db = self._session_local()
        try:
            content_hash = make_content_hash(registry_key)
            existing = db.query(self._models.SnsPost).filter(
                self._models.SnsPost.content_hash == content_hash,
                self._models.SnsPost.target_date == _target_date_value(target_date),
            ).first()
            return bool(existing)
        finally:
            db.close()

    def record(self, registry_key: str, target_date: str, post_type: str, video_id: Optional[str]) -> None:
        if not self.enabled or self._models is None or self._session_local is None:
            print("動画投稿レジストリは無効です。旧SNS投稿記録をスキップします。")
            return
        db = self._session_local()
        try:
            content_hash = make_content_hash(registry_key)
            existing = db.query(self._models.SnsPost).filter(
                self._models.SnsPost.content_hash == content_hash,
                self._models.SnsPost.target_date == _target_date_value(target_date),
            ).first()
            stored_id = f"youtube:{video_id}" if video_id else None
            if existing:
                if stored_id and not existing.tweet_id:
                    existing.tweet_id = stored_id
                existing.post_type = post_type
            else:
                db.add(
                    self._models.SnsPost(
                        content_hash=content_hash,
                        post_type=post_type,
                        posted_at=datetime.now(JST),
                        target_date=_target_date_value(target_date),
                        tweet_id=stored_id,
                    )
                )
            db.commit()
        except Exception as exc:
            db.rollback()
            raise RuntimeError(f"旧SNS投稿記録の保存に失敗しました: {exc}") from exc
        finally:
            db.close()

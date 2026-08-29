from __future__ import annotations

import math
import mimetypes
import os
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional, Sequence, Tuple


JST = timezone(timedelta(hours=9))
UTC = timezone.utc
YOUTUBE_MANAGE_SCOPE = "https://www.googleapis.com/auth/youtube"
PUBLICATION_MODES = {"disabled", "private_review", "scheduled_public"}
YOUTUBE_API_MAX_RETRIES = 3


@dataclass(frozen=True)
class YouTubeUploadResult:
    video_id: str
    watch_url: str


@dataclass(frozen=True)
class YouTubeVideoStatus:
    video_id: str
    processing_status: str
    upload_status: str
    privacy_status: str
    publish_at: Optional[str]
    failure_reason: Optional[str]
    rejection_reason: Optional[str]


class YouTubeVideoStatusUnavailableError(RuntimeError):
    """アップロード直後など、動画状態が一時的に一覧へ現れない場合の再試行可能エラー。"""


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} が設定されていません。")
    return value


def validate_publication_mode(value: str) -> str:
    normalized = str(value or "").strip().lower()
    if normalized not in PUBLICATION_MODES:
        raise ValueError(f"YOUTUBE_PUBLICATION_MODEが不正です: {value}")
    return normalized


def _requested_publish_datetime(
    target_date: str,
    publish_time_jst: str,
    offset_minutes: int = 0,
) -> datetime:
    publish_date = datetime.fromisoformat(target_date).date() - timedelta(days=1)
    try:
        hour_text, minute_text = publish_time_jst.split(":", 1)
        hour = int(hour_text)
        minute = int(minute_text)
        if not 0 <= hour <= 23 or not 0 <= minute <= 59:
            raise ValueError
    except ValueError as exc:
        raise ValueError(f"公開時刻はHH:MM形式で指定してください: {publish_time_jst}") from exc
    publish_dt = datetime(
        publish_date.year,
        publish_date.month,
        publish_date.day,
        hour,
        minute,
        tzinfo=JST,
    ) + timedelta(minutes=offset_minutes)
    return publish_dt


def build_publish_at(
    target_date: str,
    publish_time_jst: str,
    offset_minutes: int = 0,
    *,
    now_jst: Optional[datetime] = None,
) -> str:
    publish_dt = _requested_publish_datetime(target_date, publish_time_jst, offset_minutes)
    effective_now_jst = (now_jst or datetime.now(JST)).astimezone(JST)
    if publish_dt <= effective_now_jst + timedelta(minutes=5):
        raise RuntimeError(
            "予約公開時刻を過ぎています。時刻を自動変更せず投稿を中止します: "
            f"{publish_dt.isoformat()}"
        )
    return publish_dt.astimezone(UTC).isoformat().replace("+00:00", "Z")


def build_publish_schedule(
    target_date: str,
    publish_time_jst: str,
    offsets_minutes: Sequence[int],
    *,
    now_jst: Optional[datetime] = None,
    minimum_lead_minutes: int = 45,
    slot_minutes: int = 10,
    maximum_shift_minutes: int = 840,
    publish_cutoff_time_jst: str = "09:00",
) -> Tuple[List[str], int]:
    """Actions遅延時も公開順を保ったまま、予約枠全体を安全に後ろへ移動する。"""
    offsets = [int(offset) for offset in offsets_minutes]
    if not offsets:
        return [], 0
    if minimum_lead_minutes < 5:
        raise ValueError("予約公開までの最低猶予は5分以上にしてください。")
    if slot_minutes <= 0:
        raise ValueError("予約公開枠の単位は1分以上にしてください。")
    if maximum_shift_minutes < 0:
        raise ValueError("予約公開の最大後ろ倒し時間は0分以上にしてください。")

    try:
        cutoff_hour_text, cutoff_minute_text = publish_cutoff_time_jst.split(":", 1)
        cutoff_hour = int(cutoff_hour_text)
        cutoff_minute = int(cutoff_minute_text)
        if not 0 <= cutoff_hour <= 23 or not 0 <= cutoff_minute <= 59:
            raise ValueError
    except ValueError as exc:
        raise ValueError(f"公開締切時刻はHH:MM形式で指定してください: {publish_cutoff_time_jst}") from exc

    effective_now_jst = (now_jst or datetime.now(JST)).astimezone(JST)
    requested_datetimes = [
        _requested_publish_datetime(target_date, publish_time_jst, offset)
        for offset in offsets
    ]
    earliest_requested = min(requested_datetimes)
    minimum_publish_at = effective_now_jst + timedelta(minutes=minimum_lead_minutes)
    shift_minutes = 0
    if earliest_requested <= minimum_publish_at:
        required_seconds = (minimum_publish_at - earliest_requested).total_seconds()
        required_minutes = max(0, math.ceil(required_seconds / 60))
        shift_minutes = (
            (required_minutes + slot_minutes - 1) // slot_minutes
        ) * slot_minutes
        if shift_minutes > maximum_shift_minutes:
            raise RuntimeError(
                "GitHub Actionsの遅延が許容範囲を超えたため、古い内容の自動公開を中止します: "
                f"必要な後ろ倒し={shift_minutes}分 / 上限={maximum_shift_minutes}分"
            )

    effective_datetimes = [
        requested + timedelta(minutes=shift_minutes)
        for requested in requested_datetimes
    ]
    target = datetime.fromisoformat(target_date).date()
    publish_cutoff = datetime(
        target.year,
        target.month,
        target.day,
        cutoff_hour,
        cutoff_minute,
        tzinfo=JST,
    )
    if max(effective_datetimes) > publish_cutoff:
        raise RuntimeError(
            "GitHub Actionsの遅延により対象日の自動公開締切を超えるため投稿を中止します: "
            f"最終予約={max(effective_datetimes).isoformat()} / 締切={publish_cutoff.isoformat()}"
        )
    if min(effective_datetimes) <= effective_now_jst + timedelta(minutes=5):
        raise RuntimeError("予約公開までの安全な猶予を確保できません。")
    return [
        publish_dt.astimezone(UTC).isoformat().replace("+00:00", "Z")
        for publish_dt in effective_datetimes
    ], shift_minutes


def parse_publish_at(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed
    return parsed.astimezone(UTC).replace(tzinfo=None)


def estimate_quota_units(video_count: int, thumbnail_count: int, status_polls_per_video: int = 6) -> int:
    """Data APIの日次クォータを事前評価するための保守的な概算。"""
    return max(0, video_count) * 100 + max(0, thumbnail_count) * 50 + max(0, video_count) * max(1, status_polls_per_video)


class YouTubeClient:
    def __init__(self) -> None:
        self.client_id = _require_env("YOUTUBE_CLIENT_ID")
        self.client_secret = _require_env("YOUTUBE_CLIENT_SECRET")
        self.refresh_token = _require_env("YOUTUBE_REFRESH_TOKEN")
        self.channel_id = os.getenv("YOUTUBE_CHANNEL_ID")
        self._service = None

    def _build_service(self):
        if self._service is not None:
            return self._service
        try:
            from google.oauth2.credentials import Credentials
            from googleapiclient.discovery import build
        except ImportError as exc:
            raise RuntimeError(
                "YouTube投稿には google-api-python-client と google-auth が必要です。backend/requirements.txtを確認してください。"
            ) from exc
        credentials = Credentials(
            token=None,
            refresh_token=self.refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=self.client_id,
            client_secret=self.client_secret,
            scopes=[YOUTUBE_MANAGE_SCOPE],
        )
        self._service = build("youtube", "v3", credentials=credentials, cache_discovery=False)
        return self._service

    def validate_channel(self) -> str:
        try:
            response = self._build_service().channels().list(part="id", mine=True).execute(
                num_retries=YOUTUBE_API_MAX_RETRIES
            )
        except Exception as exc:
            try:
                from google.auth.exceptions import RefreshError
            except ImportError:
                RefreshError = ()  # type: ignore[assignment,misc]
            if isinstance(exc, RefreshError) and "invalid_grant" in str(exc).lower():
                raise RuntimeError(
                    "YouTube OAuth refresh tokenが失効または取り消されています。"
                    "Google Auth Platformの公開ステータスを本番環境にしたうえで、"
                    "管理アカウントを再認証し、GitHub Actions Secret "
                    "YOUTUBE_REFRESH_TOKENを新しい値へ更新してください。"
                ) from exc
            raise
        items = response.get("items") or []
        if len(items) != 1:
            raise RuntimeError("認証したYouTubeチャンネルを一意に確認できません。")
        authenticated_channel_id = str(items[0].get("id") or "")
        if not authenticated_channel_id:
            raise RuntimeError("認証したYouTubeチャンネルIDを取得できません。")
        if self.channel_id and authenticated_channel_id != self.channel_id:
            raise RuntimeError(
                "認証チャンネルがYOUTUBE_CHANNEL_IDと一致しません: "
                f"認証={authenticated_channel_id} 設定={self.channel_id}"
            )
        return authenticated_channel_id

    def insert_video(
        self,
        *,
        video_path: Path,
        title: str,
        description: str,
        tags: List[str],
        publish_at: Optional[str],
        notify_subscribers: bool = False,
    ) -> YouTubeUploadResult:
        if not video_path.exists():
            raise RuntimeError(f"動画ファイルが見つかりません: {video_path}")
        try:
            from googleapiclient.http import MediaFileUpload
        except ImportError as exc:
            raise RuntimeError("googleapiclientが読み込めません。依存関係を確認してください。") from exc

        status = {
            "privacyStatus": "private",
            "selfDeclaredMadeForKids": False,
        }
        if publish_at:
            status["publishAt"] = publish_at
        body = {
            "snippet": {
                "title": title[:100],
                "description": description,
                "tags": [tag for tag in tags if tag][:30],
                "categoryId": "17",
            },
            "status": status,
        }
        request = self._build_service().videos().insert(
            part="snippet,status",
            body=body,
            notifySubscribers=notify_subscribers,
            media_body=MediaFileUpload(
                str(video_path),
                chunksize=8 * 1024 * 1024,
                resumable=True,
                mimetype="video/mp4",
            ),
        )
        response: Optional[dict] = None
        while response is None:
            progress, response = request.next_chunk(num_retries=YOUTUBE_API_MAX_RETRIES)
            if progress:
                print(f"YouTubeアップロード進捗: {int(progress.progress() * 100)}%")
        video_id = str(response.get("id") or "")
        if not video_id:
            raise RuntimeError(f"YouTubeアップロード応答にvideoIdがありません: {response}")
        return YouTubeUploadResult(video_id=video_id, watch_url=f"https://www.youtube.com/watch?v={video_id}")

    def set_thumbnail(self, video_id: str, thumbnail_path: Path) -> None:
        if not thumbnail_path.exists():
            raise RuntimeError(f"サムネイルが見つかりません: {thumbnail_path}")
        if thumbnail_path.stat().st_size > 2 * 1024 * 1024:
            raise RuntimeError(f"サムネイルが2MBを超えています: {thumbnail_path}")
        try:
            from googleapiclient.http import MediaFileUpload
        except ImportError as exc:
            raise RuntimeError("googleapiclientが読み込めません。依存関係を確認してください。") from exc
        self._build_service().thumbnails().set(
            videoId=video_id,
            media_body=MediaFileUpload(
                str(thumbnail_path),
                mimetype=mimetypes.guess_type(thumbnail_path.name)[0] or "image/jpeg",
            ),
        ).execute(num_retries=YOUTUBE_API_MAX_RETRIES)

    def get_video_status(self, video_id: str) -> YouTubeVideoStatus:
        items = []
        for visibility_attempt in range(YOUTUBE_API_MAX_RETRIES + 1):
            response = self._build_service().videos().list(
                part="status,processingDetails",
                id=video_id,
            ).execute(num_retries=YOUTUBE_API_MAX_RETRIES)
            items = response.get("items") or []
            if items:
                break
            if visibility_attempt < YOUTUBE_API_MAX_RETRIES:
                time.sleep(2 ** visibility_attempt)
        if not items:
            raise YouTubeVideoStatusUnavailableError(f"YouTube上の動画状態を取得できません: {video_id}")
        item = items[0]
        status = item.get("status") or {}
        processing = item.get("processingDetails") or {}
        return YouTubeVideoStatus(
            video_id=video_id,
            processing_status=str(processing.get("processingStatus") or ""),
            upload_status=str(status.get("uploadStatus") or ""),
            privacy_status=str(status.get("privacyStatus") or ""),
            publish_at=str(status.get("publishAt")) if status.get("publishAt") else None,
            failure_reason=str(processing.get("processingFailureReason")) if processing.get("processingFailureReason") else None,
            rejection_reason=str(status.get("rejectionReason")) if status.get("rejectionReason") else None,
        )

    def clear_publish_schedule(self, video_id: str) -> YouTubeVideoStatus:
        """部分失敗後に安全モードへ戻る際、既存動画の予約時刻を解除する。"""
        current = self.get_video_status(video_id)
        if current.privacy_status == "public":
            return current
        self._build_service().videos().update(
            part="status",
            body={
                "id": video_id,
                "status": {
                    "privacyStatus": "private",
                    "selfDeclaredMadeForKids": False,
                },
            },
        ).execute(num_retries=YOUTUBE_API_MAX_RETRIES)
        status = self.get_video_status(video_id)
        if status.privacy_status == "public":
            return status
        if status.privacy_status != "private" or status.publish_at:
            raise RuntimeError(
                "YouTube動画の予約公開を解除できません: "
                f"{video_id} (privacyStatus={status.privacy_status}, publishAt={status.publish_at})"
            )
        return status

    def wait_for_processing(
        self,
        video_id: str,
        *,
        expected_publish_at: Optional[str] = None,
        timeout_seconds: int = 600,
        poll_interval_seconds: int = 10,
    ) -> YouTubeVideoStatus:
        deadline = time.monotonic() + max(1, timeout_seconds)
        while True:
            try:
                status = self.get_video_status(video_id)
            except YouTubeVideoStatusUnavailableError as exc:
                if time.monotonic() >= deadline:
                    raise RuntimeError(
                        f"YouTube動画の状態確認がタイムアウトしました: {video_id}"
                    ) from exc
                time.sleep(max(1, poll_interval_seconds))
                continue
            if status.processing_status in {"failed", "terminated"} or status.upload_status in {"failed", "rejected", "deleted"}:
                reason = status.failure_reason or status.rejection_reason or status.processing_status or status.upload_status
                raise RuntimeError(f"YouTube動画の処理に失敗しました: {video_id} ({reason})")
            processed = status.processing_status == "succeeded" or status.upload_status == "processed"
            if processed:
                expected = parse_publish_at(expected_publish_at)
                if status.privacy_status == "public":
                    return status
                if status.privacy_status != "private":
                    raise RuntimeError(
                        f"YouTube動画が意図しない公開状態です: {video_id} ({status.privacy_status})"
                    )
                if expected_publish_at and not status.publish_at:
                    raise RuntimeError(f"YouTube動画に予約公開時刻が反映されていません: {video_id}")
                if expected_publish_at and status.publish_at:
                    actual = parse_publish_at(status.publish_at)
                    if expected is None or actual is None or abs((actual - expected).total_seconds()) > 1:
                        raise RuntimeError(
                            "YouTube動画の予約公開時刻が要求値と一致しません: "
                            f"{video_id} (要求={expected_publish_at}, 実際={status.publish_at})"
                        )
                return status
            if time.monotonic() >= deadline:
                raise RuntimeError(f"YouTube動画の処理確認がタイムアウトしました: {video_id}")
            time.sleep(max(1, poll_interval_seconds))

    def upload_video(
        self,
        video_path: Path,
        thumbnail_path: Path,
        title: str,
        description: str,
        tags: List[str],
        publish_at: Optional[str],
        privacy_status: str = "private",
        notify_subscribers: bool = False,
    ) -> YouTubeUploadResult:
        """旧呼び出し互換。新規パイプラインは段階APIを直接利用する。"""
        if privacy_status != "private":
            raise ValueError("安全な予約公開のためprivacy_statusはprivateだけを許可します。")
        result = self.insert_video(
            video_path=video_path,
            title=title,
            description=description,
            tags=tags,
            publish_at=publish_at,
            notify_subscribers=notify_subscribers,
        )
        self.set_thumbnail(result.video_id, thumbnail_path)
        self.wait_for_processing(result.video_id, expected_publish_at=publish_at)
        return result

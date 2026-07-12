from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional


JST = timezone(timedelta(hours=9))
UTC = timezone.utc
YOUTUBE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload"


@dataclass
class YouTubeUploadResult:
    video_id: str
    watch_url: str


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} が設定されていません。")
    return value


def build_publish_at(target_date: str, publish_time_jst: str, offset_minutes: int = 0) -> str:
    publish_date = datetime.fromisoformat(target_date).date() - timedelta(days=1)
    hour_text, minute_text = publish_time_jst.split(":", 1)
    publish_dt = datetime(
        publish_date.year,
        publish_date.month,
        publish_date.day,
        int(hour_text),
        int(minute_text),
        tzinfo=JST,
    ) + timedelta(minutes=offset_minutes)
    now_jst = datetime.now(JST)
    if publish_dt <= now_jst + timedelta(minutes=5):
        publish_dt = now_jst + timedelta(minutes=15 + offset_minutes)
    return publish_dt.astimezone(UTC).isoformat().replace("+00:00", "Z")


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
                "YouTube投稿には google-api-python-client と google-auth が必要です。backend/requirements.txt をインストールしてください。"
            ) from exc
        credentials = Credentials(
            token=None,
            refresh_token=self.refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=self.client_id,
            client_secret=self.client_secret,
            scopes=[YOUTUBE_UPLOAD_SCOPE],
        )
        self._service = build("youtube", "v3", credentials=credentials, cache_discovery=False)
        return self._service

    def upload_video(
        self,
        video_path: Path,
        thumbnail_path: Path,
        title: str,
        description: str,
        tags: List[str],
        publish_at: str,
        privacy_status: str = "private",
        notify_subscribers: bool = False,
    ) -> YouTubeUploadResult:
        if not video_path.exists():
            raise RuntimeError(f"動画ファイルが見つかりません: {video_path}")
        if not thumbnail_path.exists():
            raise RuntimeError(f"サムネイルが見つかりません: {thumbnail_path}")
        try:
            from googleapiclient.http import MediaFileUpload
        except ImportError as exc:
            raise RuntimeError("googleapiclient が読み込めません。依存関係を確認してください。") from exc

        service = self._build_service()
        body = {
            "snippet": {
                "title": title[:100],
                "description": description,
                "tags": [tag for tag in tags if tag][:30],
                "categoryId": "17",
            },
            "status": {
                "privacyStatus": privacy_status,
                "publishAt": publish_at if privacy_status == "private" else None,
                "selfDeclaredMadeForKids": False,
            },
        }
        if body["status"]["publishAt"] is None:
            del body["status"]["publishAt"]

        request = service.videos().insert(
            part="snippet,status",
            body=body,
            notifySubscribers=notify_subscribers,
            media_body=MediaFileUpload(str(video_path), chunksize=8 * 1024 * 1024, resumable=True, mimetype="video/mp4"),
        )
        response: Optional[dict] = None
        while response is None:
            status, response = request.next_chunk()
            if status:
                print(f"YouTubeアップロード進捗: {int(status.progress() * 100)}%")
        video_id = str(response.get("id") or "")
        if not video_id:
            raise RuntimeError(f"YouTubeアップロード応答にvideoIdがありません: {response}")

        service.thumbnails().set(
            videoId=video_id,
            media_body=MediaFileUpload(str(thumbnail_path), mimetype="image/png"),
        ).execute()
        return YouTubeUploadResult(video_id=video_id, watch_url=f"https://www.youtube.com/watch?v={video_id}")


from __future__ import annotations

import json
import mimetypes
import os
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable

import requests

from .distribution import SocialVideoVariant
from .gcs_staging import GcsMediaStager


DEFAULT_TIMEOUT_SECONDS = 90
META_GRAPH_VERSION = os.getenv("META_GRAPH_API_VERSION", "v23.0")
META_GRAPH_BASE = f"https://graph.facebook.com/{META_GRAPH_VERSION}"
THREADS_GRAPH_BASE = (
    os.getenv("THREADS_GRAPH_API_BASE") or "https://graph.threads.net/v1.0"
).rstrip("/")
PublishCheckpoint = Callable[[str, str, dict[str, Any]], None]


def _required_env(names: Iterable[str]) -> dict[str, str]:
    values = {name: (os.getenv(name) or "").strip() for name in names}
    missing = [name for name, value in values.items() if not value]
    if missing:
        raise RuntimeError(f"必須の認証設定がありません: {', '.join(missing)}")
    return values


def _response_json(response: requests.Response, operation: str) -> dict[str, Any]:
    if not response.ok:
        body = (response.text or "").strip().replace("\n", " ")
        raise RuntimeError(
            f"{operation}に失敗しました: status={response.status_code} body={body[:700]}"
        )
    try:
        payload = response.json()
    except ValueError as exc:
        raise RuntimeError(f"{operation}の応答がJSONではありません。") from exc
    if not isinstance(payload, dict):
        raise RuntimeError(f"{operation}の応答形式が不正です。")
    return payload


def _retry_request(
    method: str,
    url: str,
    *,
    attempts: int = 3,
    **kwargs: Any,
) -> requests.Response:
    last_response: requests.Response | None = None
    last_error: Exception | None = None
    timeout = kwargs.get("timeout", DEFAULT_TIMEOUT_SECONDS)
    request_kwargs = {
        key: value
        for key, value in kwargs.items()
        if key != "timeout"
    }
    for attempt in range(1, attempts + 1):
        try:
            data = request_kwargs.get("data")
            if hasattr(data, "seek"):
                data.seek(0)
            files = request_kwargs.get("files")
            if isinstance(files, dict):
                for file_value in files.values():
                    file_object = (
                        file_value[1]
                        if isinstance(file_value, tuple) and len(file_value) >= 2
                        else file_value
                    )
                    if hasattr(file_object, "seek"):
                        file_object.seek(0)
            response = requests.request(
                method,
                url,
                timeout=timeout,
                **request_kwargs,
            )
            last_response = response
            if response.status_code < 500 and response.status_code != 429:
                return response
        except requests.RequestException as exc:
            last_error = exc
        if attempt < attempts:
            time.sleep(min(2 ** (attempt - 1), 4))
    if last_response is not None:
        return last_response
    raise RuntimeError(f"外部APIへの接続に失敗しました: {last_error}") from last_error


@dataclass(frozen=True)
class PublishResult:
    platform: str
    status: str
    remote_id: str = ""
    permalink: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


class SocialPublisher(ABC):
    platform: str
    supported_mutation_modes: frozenset[str] = frozenset({"public"})

    def validate_mode(self, mode: str) -> None:
        if mode not in self.supported_mutation_modes:
            allowed = ", ".join(sorted(self.supported_mutation_modes))
            raise RuntimeError(
                f"{self.platform}は{mode}投稿に対応していません。"
                f" 外部変更を行う場合は {allowed} を指定してください。"
            )

    @abstractmethod
    def validate_credentials(self) -> None:
        raise NotImplementedError

    @abstractmethod
    def publish(
        self,
        variant: SocialVideoVariant,
        stager: GcsMediaStager,
        checkpoint: PublishCheckpoint | None = None,
    ) -> PublishResult:
        raise NotImplementedError


class ThreadsPublisher(SocialPublisher):
    platform = "threads"

    def validate_credentials(self) -> None:
        _required_env(("THREADS_USER_ID", "THREADS_ACCESS_TOKEN"))

    def publish(
        self,
        variant: SocialVideoVariant,
        stager: GcsMediaStager,
        checkpoint: PublishCheckpoint | None = None,
    ) -> PublishResult:
        self.validate_mode(variant.mode)
        credentials = _required_env(("THREADS_USER_ID", "THREADS_ACCESS_TOKEN"))
        staged = stager.stage(
            variant.video_path,
            f"{variant.target_date}/threads/{variant.content_hash}.mp4",
        )
        create = _retry_request(
            "POST",
            f"{THREADS_GRAPH_BASE}/{credentials['THREADS_USER_ID']}/threads",
            data={
                "media_type": "VIDEO",
                "video_url": staged.signed_url,
                "text": variant.caption,
                "alt_text": variant.alt_text,
                "access_token": credentials["THREADS_ACCESS_TOKEN"],
            },
        )
        container = _response_json(create, "Threads動画コンテナ作成").get("id")
        if not container:
            raise RuntimeError("Threads動画コンテナIDが返されませんでした。")
        if checkpoint:
            checkpoint(str(container), "uploading", {"container_id": str(container)})
        _wait_meta_container(
            str(container),
            credentials["THREADS_ACCESS_TOKEN"],
            status_field="status",
            graph_base=THREADS_GRAPH_BASE,
        )
        publish = _retry_request(
            "POST",
            f"{THREADS_GRAPH_BASE}/{credentials['THREADS_USER_ID']}/threads_publish",
            data={
                "creation_id": container,
                "access_token": credentials["THREADS_ACCESS_TOKEN"],
            },
        )
        payload = _response_json(publish, "Threads動画公開")
        remote_id = str(payload.get("id") or "")
        permalink = ""
        if remote_id:
            info = _retry_request(
                "GET",
                f"{THREADS_GRAPH_BASE}/{remote_id}",
                params={
                    "fields": "permalink",
                    "access_token": credentials["THREADS_ACCESS_TOKEN"],
                },
            )
            if info.ok:
                permalink = str(info.json().get("permalink") or "")
        return PublishResult(
            platform=self.platform,
            status="published",
            remote_id=remote_id,
            permalink=permalink,
        )


class InstagramPublisher(SocialPublisher):
    platform = "instagram"

    def validate_credentials(self) -> None:
        _required_env(("INSTAGRAM_USER_ID", "INSTAGRAM_ACCESS_TOKEN"))

    def publish(
        self,
        variant: SocialVideoVariant,
        stager: GcsMediaStager,
        checkpoint: PublishCheckpoint | None = None,
    ) -> PublishResult:
        self.validate_mode(variant.mode)
        credentials = _required_env(("INSTAGRAM_USER_ID", "INSTAGRAM_ACCESS_TOKEN"))
        staged = stager.stage(
            variant.video_path,
            f"{variant.target_date}/instagram/{variant.content_hash}.mp4",
        )
        create = _retry_request(
            "POST",
            f"{META_GRAPH_BASE}/{credentials['INSTAGRAM_USER_ID']}/media",
            data={
                "media_type": "REELS",
                "video_url": staged.signed_url,
                "caption": variant.caption,
                "share_to_feed": "true",
                "access_token": credentials["INSTAGRAM_ACCESS_TOKEN"],
            },
        )
        container = _response_json(create, "Instagram Reelsコンテナ作成").get("id")
        if not container:
            raise RuntimeError("Instagram ReelsコンテナIDが返されませんでした。")
        if checkpoint:
            checkpoint(str(container), "uploading", {"container_id": str(container)})
        _wait_meta_container(
            str(container),
            credentials["INSTAGRAM_ACCESS_TOKEN"],
            status_field="status_code",
        )
        publish = _retry_request(
            "POST",
            f"{META_GRAPH_BASE}/{credentials['INSTAGRAM_USER_ID']}/media_publish",
            data={
                "creation_id": container,
                "access_token": credentials["INSTAGRAM_ACCESS_TOKEN"],
            },
        )
        payload = _response_json(publish, "Instagram Reels公開")
        remote_id = str(payload.get("id") or "")
        permalink = ""
        if remote_id:
            info = _retry_request(
                "GET",
                f"{META_GRAPH_BASE}/{remote_id}",
                params={
                    "fields": "permalink",
                    "access_token": credentials["INSTAGRAM_ACCESS_TOKEN"],
                },
            )
            permalink = str(_response_json(info, "Instagram permalink取得").get("permalink") or "")
        return PublishResult(self.platform, "published", remote_id, permalink)


def _wait_meta_container(
    container_id: str,
    access_token: str,
    *,
    status_field: str,
    graph_base: str = META_GRAPH_BASE,
    attempts: int = 30,
    delay_seconds: int = 10,
) -> None:
    for attempt in range(1, attempts + 1):
        response = _retry_request(
            "GET",
            f"{graph_base}/{container_id}",
            params={
                "fields": f"{status_field},status,error_message",
                "access_token": access_token,
            },
        )
        payload = _response_json(response, "Meta動画処理状態確認")
        status = str(payload.get(status_field) or payload.get("status") or "").upper()
        if status in {"FINISHED", "PUBLISHED"}:
            return
        if status in {"ERROR", "EXPIRED"}:
            raise RuntimeError(
                f"Meta動画処理が失敗しました: {payload.get('error_message') or status}"
            )
        if attempt < attempts:
            time.sleep(delay_seconds)
    raise RuntimeError("Meta動画処理が制限時間内に完了しませんでした。")


class FacebookPublisher(SocialPublisher):
    platform = "facebook"
    supported_mutation_modes = frozenset({"draft", "public"})

    def validate_credentials(self) -> None:
        _required_env(("FACEBOOK_PAGE_ID", "FACEBOOK_PAGE_ACCESS_TOKEN"))

    def publish(
        self,
        variant: SocialVideoVariant,
        stager: GcsMediaStager,
        checkpoint: PublishCheckpoint | None = None,
    ) -> PublishResult:
        del stager
        self.validate_mode(variant.mode)
        credentials = _required_env(("FACEBOOK_PAGE_ID", "FACEBOOK_PAGE_ACCESS_TOKEN"))
        start = _retry_request(
            "POST",
            f"{META_GRAPH_BASE}/{credentials['FACEBOOK_PAGE_ID']}/video_reels",
            data={
                "upload_phase": "start",
                "access_token": credentials["FACEBOOK_PAGE_ACCESS_TOKEN"],
            },
        )
        start_payload = _response_json(start, "Facebook Reelsアップロード開始")
        video_id = str(start_payload.get("video_id") or "")
        upload_url = str(start_payload.get("upload_url") or "")
        if not video_id or not upload_url:
            raise RuntimeError("Facebook Reelsのアップロード情報が返されませんでした。")
        if checkpoint:
            checkpoint(video_id, "uploading", {"video_id": video_id})
        video_size = variant.video_path.stat().st_size
        with variant.video_path.open("rb") as video_file:
            upload = _retry_request(
                "POST",
                upload_url,
                headers={
                    "Authorization": f"OAuth {credentials['FACEBOOK_PAGE_ACCESS_TOKEN']}",
                    "offset": "0",
                    "file_size": str(video_size),
                    "Content-Type": "application/octet-stream",
                },
                data=video_file,
                attempts=2,
                timeout=300,
            )
        _response_json(upload, "Facebook Reels動画転送")
        video_state = "DRAFT" if variant.mode == "draft" else "PUBLISHED"
        finish = _retry_request(
            "POST",
            f"{META_GRAPH_BASE}/{credentials['FACEBOOK_PAGE_ID']}/video_reels",
            data={
                "upload_phase": "finish",
                "video_id": video_id,
                "video_state": video_state,
                "title": variant.title,
                "description": variant.caption,
                "access_token": credentials["FACEBOOK_PAGE_ACCESS_TOKEN"],
            },
        )
        _response_json(finish, "Facebook Reels投稿確定")
        return PublishResult(
            self.platform,
            "draft" if variant.mode == "draft" else "published",
            video_id,
            f"https://www.facebook.com/reel/{video_id}" if variant.mode == "public" else "",
        )


class TikTokPublisher(SocialPublisher):
    platform = "tiktok"
    supported_mutation_modes = frozenset({"draft", "public"})
    API_BASE = "https://open.tiktokapis.com"

    def validate_credentials(self) -> None:
        _required_env(("TIKTOK_ACCESS_TOKEN",))
        if os.getenv("TIKTOK_AUTO_PUBLISH_CONSENT", "").strip().lower() not in {
            "1",
            "true",
            "yes",
            "on",
        }:
            raise RuntimeError("TIKTOK_AUTO_PUBLISH_CONSENT=trueの明示確認が必要です。")

    def publish(
        self,
        variant: SocialVideoVariant,
        stager: GcsMediaStager,
        checkpoint: PublishCheckpoint | None = None,
    ) -> PublishResult:
        del stager
        self.validate_mode(variant.mode)
        self.validate_credentials()
        token = (os.getenv("TIKTOK_ACCESS_TOKEN") or "").strip()
        if variant.mode == "public":
            if os.getenv("TIKTOK_APP_AUDITED", "").strip().lower() not in {
                "1",
                "true",
                "yes",
                "on",
            }:
                raise RuntimeError("TikTok Content Posting APIの監査完了確認が必要です。")
            if os.getenv("TIKTOK_PRIVACY_LEVEL", "").strip() != "PUBLIC_TO_EVERYONE":
                raise RuntimeError(
                    "publicモードではTIKTOK_PRIVACY_LEVEL=PUBLIC_TO_EVERYONEが必要です。"
                )
        endpoint = (
            "/v2/post/publish/inbox/video/init/"
            if variant.mode == "draft"
            else "/v2/post/publish/video/init/"
        )
        size = variant.video_path.stat().st_size
        body: dict[str, Any] = {
            "source_info": {
                "source": "FILE_UPLOAD",
                "video_size": size,
                "chunk_size": size,
                "total_chunk_count": 1,
            }
        }
        if variant.mode == "public":
            body["post_info"] = {
                "title": variant.caption,
                "privacy_level": os.getenv(
                    "TIKTOK_PRIVACY_LEVEL",
                    "PUBLIC_TO_EVERYONE",
                ),
                "disable_duet": False,
                "disable_comment": False,
                "disable_stitch": False,
                "video_cover_timestamp_ms": 1000,
                "brand_organic_toggle": True,
                "is_aigc": False,
            }
        init = _retry_request(
            "POST",
            f"{self.API_BASE}{endpoint}",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json; charset=UTF-8",
            },
            json=body,
        )
        payload = _response_json(init, "TikTok動画投稿初期化")
        data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
        publish_id = str(data.get("publish_id") or "")
        upload_url = str(data.get("upload_url") or "")
        if not publish_id or not upload_url:
            raise RuntimeError("TikTokのアップロード情報が返されませんでした。")
        if checkpoint:
            checkpoint(publish_id, "uploading", {"publish_id": publish_id})
        with variant.video_path.open("rb") as video_file:
            upload = _retry_request(
                "PUT",
                upload_url,
                headers={
                    "Content-Type": "video/mp4",
                    "Content-Length": str(size),
                    "Content-Range": f"bytes 0-{size - 1}/{size}",
                },
                data=video_file,
                attempts=2,
                timeout=300,
            )
        if not upload.ok:
            _response_json(upload, "TikTok動画転送")
        return PublishResult(
            self.platform,
            "draft" if variant.mode == "draft" else "published",
            publish_id,
            metadata=(
                {}
                if variant.mode == "draft"
                else _wait_tiktok_publish(publish_id, token)
            ),
        )


def _wait_tiktok_publish(
    publish_id: str,
    access_token: str,
    attempts: int = 30,
    delay_seconds: int = 10,
) -> dict[str, Any]:
    for attempt in range(1, attempts + 1):
        response = _retry_request(
            "POST",
            f"{TikTokPublisher.API_BASE}/v2/post/publish/status/fetch/",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json; charset=UTF-8",
            },
            json={"publish_id": publish_id},
        )
        payload = _response_json(response, "TikTok投稿状態確認")
        data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
        status = str(data.get("status") or "").upper()
        if status in {"PUBLISH_COMPLETE", "SEND_TO_USER_INBOX"}:
            post_ids = data.get("publicaly_available_post_id") or []
            return {
                "tiktok_status": status,
                "post_ids": post_ids if isinstance(post_ids, list) else [],
            }
        if status == "FAILED":
            fail_reason = str(data.get("fail_reason") or "不明な理由")
            raise RuntimeError(f"TikTok投稿処理が失敗しました: {fail_reason}")
        if attempt < attempts:
            time.sleep(delay_seconds)
    raise RuntimeError("TikTok投稿処理が制限時間内に完了しませんでした。")


class PinterestPublisher(SocialPublisher):
    platform = "pinterest"
    API_BASE = "https://api.pinterest.com/v5"

    def validate_credentials(self) -> None:
        _required_env(("PINTEREST_ACCESS_TOKEN", "PINTEREST_BOARD_ID"))

    def publish(
        self,
        variant: SocialVideoVariant,
        stager: GcsMediaStager,
        checkpoint: PublishCheckpoint | None = None,
    ) -> PublishResult:
        self.validate_mode(variant.mode)
        credentials = _required_env(("PINTEREST_ACCESS_TOKEN", "PINTEREST_BOARD_ID"))
        headers = {
            "Authorization": f"Bearer {credentials['PINTEREST_ACCESS_TOKEN']}",
            "Content-Type": "application/json",
        }
        register = _retry_request(
            "POST",
            f"{self.API_BASE}/media",
            headers=headers,
            json={"media_type": "video"},
        )
        register_payload = _response_json(register, "Pinterest動画登録")
        media_id = str(register_payload.get("media_id") or "")
        upload_url = str(register_payload.get("upload_url") or "")
        upload_parameters = register_payload.get("upload_parameters")
        if not media_id or not upload_url or not isinstance(upload_parameters, dict):
            raise RuntimeError("Pinterestの動画アップロード情報が返されませんでした。")
        if checkpoint:
            checkpoint(media_id, "uploading", {"media_id": media_id})
        mime_type = mimetypes.guess_type(variant.video_path.name)[0] or "video/mp4"
        with variant.video_path.open("rb") as video_file:
            upload = _retry_request(
                "POST",
                upload_url,
                data={str(key): str(value) for key, value in upload_parameters.items()},
                files={"file": (variant.video_path.name, video_file, mime_type)},
                attempts=2,
                timeout=300,
            )
        if not upload.ok:
            raise RuntimeError(f"Pinterest動画転送に失敗しました: status={upload.status_code}")
        _wait_pinterest_media(media_id, credentials["PINTEREST_ACCESS_TOKEN"])
        cover = stager.stage(
            variant.cover_path,
            f"{variant.target_date}/pinterest/{variant.content_hash}.png",
        )
        create = _retry_request(
            "POST",
            f"{self.API_BASE}/pins",
            headers=headers,
            json={
                "board_id": credentials["PINTEREST_BOARD_ID"],
                "title": variant.title[:100],
                "description": variant.caption,
                "alt_text": variant.alt_text[:500],
                "link": variant.destination_url,
                "media_source": {
                    "source_type": "video_id",
                    "media_id": media_id,
                    "cover_image_url": cover.signed_url,
                },
            },
        )
        payload = _response_json(create, "Pinterest Video Pin公開")
        pin_id = str(payload.get("id") or "")
        return PublishResult(
            self.platform,
            "published",
            pin_id,
            f"https://www.pinterest.com/pin/{pin_id}/" if pin_id else "",
        )


def _wait_pinterest_media(
    media_id: str,
    access_token: str,
    attempts: int = 30,
    delay_seconds: int = 10,
) -> None:
    for attempt in range(1, attempts + 1):
        response = _retry_request(
            "GET",
            f"{PinterestPublisher.API_BASE}/media/{media_id}",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        payload = _response_json(response, "Pinterest動画処理状態確認")
        status = str(payload.get("status") or "").lower()
        if status == "succeeded":
            return
        if status == "failed":
            raise RuntimeError("Pinterest動画処理が失敗しました。")
        if attempt < attempts:
            time.sleep(delay_seconds)
    raise RuntimeError("Pinterest動画処理が制限時間内に完了しませんでした。")


def _bluesky_link_facets(text: str, url: str) -> list[dict[str, Any]]:
    start = text.find(url)
    if start < 0:
        return []
    byte_start = len(text[:start].encode("utf-8"))
    byte_end = byte_start + len(url.encode("utf-8"))
    return [
        {
            "index": {"byteStart": byte_start, "byteEnd": byte_end},
            "features": [
                {
                    "$type": "app.bsky.richtext.facet#link",
                    "uri": url,
                }
            ],
        }
    ]


class BlueskyPublisher(SocialPublisher):
    platform = "bluesky"

    def validate_credentials(self) -> None:
        _required_env(("BLUESKY_HANDLE", "BLUESKY_APP_PASSWORD"))

    def publish(
        self,
        variant: SocialVideoVariant,
        stager: GcsMediaStager,
        checkpoint: PublishCheckpoint | None = None,
    ) -> PublishResult:
        del stager
        self.validate_mode(variant.mode)
        credentials = _required_env(("BLUESKY_HANDLE", "BLUESKY_APP_PASSWORD"))
        pds = (os.getenv("BLUESKY_PDS_URL") or "https://bsky.social").rstrip("/")
        session_response = _retry_request(
            "POST",
            f"{pds}/xrpc/com.atproto.server.createSession",
            json={
                "identifier": credentials["BLUESKY_HANDLE"],
                "password": credentials["BLUESKY_APP_PASSWORD"],
            },
        )
        session = _response_json(session_response, "Blueskyセッション作成")
        did = str(session.get("did") or "")
        access_jwt = str(session.get("accessJwt") or "")
        if not did or not access_jwt:
            raise RuntimeError("Blueskyセッション情報が返されませんでした。")
        video_service = (
            os.getenv("BLUESKY_VIDEO_SERVICE_URL") or "https://video.bsky.app"
        ).rstrip("/")
        service_auth_response = _retry_request(
            "GET",
            f"{pds}/xrpc/com.atproto.server.getServiceAuth",
            headers={"Authorization": f"Bearer {access_jwt}"},
            params={
                "aud": "did:web:video.bsky.app",
                "lxm": "app.bsky.video.uploadVideo",
            },
        )
        service_auth = _response_json(service_auth_response, "Bluesky動画サービス認証")
        service_token = str(service_auth.get("token") or "")
        if not service_token:
            raise RuntimeError("Bluesky動画サービス用トークンが返されませんでした。")
        with variant.video_path.open("rb") as video_file:
            upload_response = _retry_request(
                "POST",
                f"{video_service}/xrpc/app.bsky.video.uploadVideo",
                headers={
                    "Authorization": f"Bearer {service_token}",
                    "Content-Type": "video/mp4",
                },
                params={
                    "did": did,
                    "name": variant.video_path.name,
                },
                data=video_file,
                attempts=2,
                timeout=300,
            )
        upload_payload = _response_json(upload_response, "Bluesky動画転送")
        job_status = (
            upload_payload.get("jobStatus")
            if isinstance(upload_payload.get("jobStatus"), dict)
            else upload_payload
        )
        job_id = str(job_status.get("jobId") or "")
        blob = job_status.get("blob")
        if job_id and checkpoint:
            checkpoint(job_id, "uploading", {"video_job_id": job_id})
        if not isinstance(blob, dict):
            if not job_id:
                raise RuntimeError("Bluesky動画処理ジョブIDが返されませんでした。")
            blob = _wait_bluesky_video(video_service, job_id, service_token)
        if not isinstance(blob, dict):
            raise RuntimeError("Bluesky動画blobが返されませんでした。")
        record = {
            "$type": "app.bsky.feed.post",
            "text": variant.caption,
            "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "langs": ["ja"],
            "facets": _bluesky_link_facets(variant.caption, variant.destination_url),
            "embed": {
                "$type": "app.bsky.embed.video",
                "video": blob,
                "alt": variant.alt_text,
            },
        }
        create = _retry_request(
            "POST",
            f"{pds}/xrpc/com.atproto.repo.createRecord",
            headers={
                "Authorization": f"Bearer {access_jwt}",
                "Content-Type": "application/json",
            },
            json={
                "repo": did,
                "collection": "app.bsky.feed.post",
                "record": record,
            },
        )
        payload = _response_json(create, "Bluesky動画公開")
        uri = str(payload.get("uri") or "")
        rkey = uri.rsplit("/", 1)[-1] if uri else ""
        return PublishResult(
            self.platform,
            "published",
            uri,
            (
                f"https://bsky.app/profile/{credentials['BLUESKY_HANDLE']}/post/{rkey}"
                if rkey
                else ""
            ),
        )


def _wait_bluesky_video(
    video_service: str,
    job_id: str,
    service_token: str,
    attempts: int = 60,
    delay_seconds: int = 5,
) -> dict[str, Any]:
    for attempt in range(1, attempts + 1):
        response = _retry_request(
            "GET",
            f"{video_service}/xrpc/app.bsky.video.getJobStatus",
            headers={"Authorization": f"Bearer {service_token}"},
            params={"jobId": job_id},
        )
        payload = _response_json(response, "Bluesky動画処理状態確認")
        job_status = (
            payload.get("jobStatus")
            if isinstance(payload.get("jobStatus"), dict)
            else payload
        )
        blob = job_status.get("blob")
        if isinstance(blob, dict):
            return blob
        state = str(job_status.get("state") or "").upper()
        if "FAILED" in state:
            raise RuntimeError(
                f"Bluesky動画処理が失敗しました: {job_status.get('error') or state}"
            )
        if attempt < attempts:
            time.sleep(delay_seconds)
    raise RuntimeError("Bluesky動画処理が制限時間内に完了しませんでした。")


PUBLISHER_TYPES: dict[str, type[SocialPublisher]] = {
    "threads": ThreadsPublisher,
    "instagram": InstagramPublisher,
    "facebook": FacebookPublisher,
    "tiktok": TikTokPublisher,
    "pinterest": PinterestPublisher,
    "bluesky": BlueskyPublisher,
}


def get_publisher(platform: str) -> SocialPublisher:
    publisher_type = PUBLISHER_TYPES.get(platform)
    if publisher_type is None:
        raise ValueError(f"未対応のSNSです: {platform}")
    return publisher_type()

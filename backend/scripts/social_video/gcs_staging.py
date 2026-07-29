from __future__ import annotations

import os
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path


SIGNED_URL_PATTERN = re.compile(r"https://[^\s]+")


@dataclass(frozen=True)
class StagedMedia:
    object_uri: str
    signed_url: str


class GcsMediaStager:
    """Meta/Pinterestが取得できる短命の署名URLを非公開GCS上に作る。"""

    def __init__(
        self,
        bucket: str | None = None,
        signing_service_account: str | None = None,
        duration: str = "24h",
    ) -> None:
        self.bucket = (bucket or os.getenv("SOCIAL_VIDEO_STAGING_GCS_BUCKET") or "").strip()
        self.signing_service_account = (
            signing_service_account
            or os.getenv("SOCIAL_VIDEO_GCS_SIGNING_SERVICE_ACCOUNT")
            or ""
        ).strip()
        self.duration = duration
        self._objects: list[str] = []

    def validate_config(self) -> None:
        if not self.bucket:
            raise RuntimeError("SOCIAL_VIDEO_STAGING_GCS_BUCKETが未設定です。")
        if self.bucket.startswith("gs://"):
            self.bucket = self.bucket.removeprefix("gs://").rstrip("/")
        if not self.signing_service_account:
            raise RuntimeError("SOCIAL_VIDEO_GCS_SIGNING_SERVICE_ACCOUNTが未設定です。")

    @staticmethod
    def _run(command: list[str]) -> str:
        completed = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        if completed.returncode != 0:
            error = (completed.stderr or completed.stdout or "不明なエラー").strip()
            raise RuntimeError(f"GCS一時配信操作に失敗しました: {error[:800]}")
        return completed.stdout

    def stage(self, local_path: Path, object_key: str) -> StagedMedia:
        self.validate_config()
        if not local_path.is_file():
            raise FileNotFoundError(f"GCSへ一時配置するファイルがありません: {local_path}")
        normalized_key = object_key.strip("/")
        object_uri = f"gs://{self.bucket}/{normalized_key}"
        self._run(["gcloud", "storage", "cp", str(local_path), object_uri])
        self._objects.append(object_uri)
        sign_command = [
            "gcloud",
            "storage",
            "sign-url",
            object_uri,
            f"--duration={self.duration}",
            f"--impersonate-service-account={self.signing_service_account}",
        ]
        output = self._run(sign_command)
        urls = SIGNED_URL_PATTERN.findall(output)
        if not urls:
            raise RuntimeError("GCS署名URLを取得できませんでした。")
        return StagedMedia(object_uri=object_uri, signed_url=urls[-1].rstrip("'\""))

    def cleanup(self) -> list[str]:
        failures: list[str] = []
        for object_uri in reversed(self._objects):
            try:
                self._run(["gcloud", "storage", "rm", object_uri])
            except Exception as exc:
                failures.append(f"{object_uri}: {exc}")
        self._objects.clear()
        return failures

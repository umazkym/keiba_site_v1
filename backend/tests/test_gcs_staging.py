"""GCS一時配置の署名URL：バケットの場所を明示して sign-url を呼ぶ。

署名するサービスアカウントは storage.buckets.get を持たないため、場所を渡さないと
sign-url が「Failed to auto-detect the region」で止まる（2026-09-25 の朝投稿で発生）。
"""

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from scripts.social_video import gcs_staging  # noqa: E402
from scripts.social_video.gcs_staging import GcsMediaStager  # noqa: E402

SIGNED_OUTPUT = "signed_url: https://storage.googleapis.com/bucket/key.jpg?X-Goog-Signature=abc\n"


class GcsMediaStagerSignUrlTest(unittest.TestCase):
    def _stage(self, stager):
        commands = []

        def fake_run(command):
            commands.append(command)
            return SIGNED_OUTPUT if "sign-url" in command else ""

        with tempfile.TemporaryDirectory() as tmp:
            image = Path(tmp) / "image.jpg"
            image.write_bytes(b"jpg")
            with patch.object(GcsMediaStager, "_run", staticmethod(fake_run)):
                staged = stager.stage(image, "/threads/image.jpg")
        sign_command = next(command for command in commands if "sign-url" in command)
        return staged, sign_command

    def test_sign_url_passes_bucket_region(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("SOCIAL_VIDEO_STAGING_GCS_REGION", None)
            stager = GcsMediaStager(bucket="gs://bucket", signing_service_account="sa@example.iam")
            staged, sign_command = self._stage(stager)
        self.assertIn(f"--region={gcs_staging.DEFAULT_STAGING_REGION}", sign_command)
        self.assertIn("--impersonate-service-account=sa@example.iam", sign_command)
        self.assertEqual(staged.object_uri, "gs://bucket/threads/image.jpg")
        self.assertTrue(staged.signed_url.startswith("https://storage.googleapis.com/"))

    def test_region_can_be_overridden_by_env(self):
        with patch.dict(os.environ, {"SOCIAL_VIDEO_STAGING_GCS_REGION": "asia-northeast1"}):
            stager = GcsMediaStager(bucket="bucket", signing_service_account="sa@example.iam")
            _, sign_command = self._stage(stager)
        self.assertIn("--region=asia-northeast1", sign_command)


if __name__ == "__main__":
    unittest.main()

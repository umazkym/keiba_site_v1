#!/usr/bin/env python3
"""分析専用OAuthの認可URLを作り、localhost callbackからrefresh tokenを受け取る。"""

from __future__ import annotations

import argparse
import json
import os
import secrets
import threading
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


PROFILES = {
    "adsense": ["https://www.googleapis.com/auth/adsense.readonly"],
    "youtube": [
        "https://www.googleapis.com/auth/yt-analytics.readonly",
        "https://www.googleapis.com/auth/youtube.readonly",
    ],
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", choices=PROFILES, required=True)
    parser.add_argument("--port", type=int)
    parser.add_argument(
        "--exchange-file",
        type=Path,
        help="一時JSONから認可コードを交換し、隣接する.result.jsonへ保存する",
    )
    return parser.parse_args()


def oauth_credentials(profile: str) -> tuple[str, str]:
    prefix = "ADSENSE" if profile == "adsense" else "YOUTUBE_ANALYTICS"
    client_id = os.environ.get(f"{prefix}_OAUTH_CLIENT_ID", "").strip()
    client_secret = os.environ.get(f"{prefix}_OAUTH_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        raise SystemExit(f"{prefix}_OAUTH_CLIENT_ID/SECRET が設定されていません。")
    return client_id, client_secret


def exchange_token(
    *, client_id: str, client_secret: str, code: str, redirect_uri: str
) -> dict[str, object]:
    request = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=urllib.parse.urlencode({
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri,
        }).encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    args = parse_args()
    if args.exchange_file:
        exchange_path = args.exchange_file.resolve()
        exchange_data = json.loads(exchange_path.read_text(encoding="utf-8"))
        payload = exchange_token(
            client_id=str(exchange_data["client_id"]),
            client_secret=str(exchange_data["client_secret"]),
            code=str(exchange_data["code"]),
            redirect_uri=str(exchange_data["redirect_uri"]),
        )
        result_path = exchange_path.with_suffix(".result.json")
        result_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        print(json.dumps({"status": "complete", "result_file": str(result_path)}))
        return 0

    if not args.port:
        raise SystemExit("通常の認可では --port が必要です。")
    client_id, client_secret = oauth_credentials(args.profile)
    state = secrets.token_urlsafe(24)
    redirect_uri = f"http://127.0.0.1:{args.port}/callback"
    result: dict[str, str] = {}
    completed = threading.Event()

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            parsed = urllib.parse.urlparse(self.path)
            query = urllib.parse.parse_qs(parsed.query)
            if parsed.path != "/callback" or query.get("state", [""])[0] != state:
                self.send_response(400)
                self.end_headers()
                self.wfile.write("Invalid OAuth callback".encode())
                return
            if query.get("error"):
                result["error"] = query["error"][0]
            else:
                result["code"] = query.get("code", [""])[0]
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(
                "<h1>認可を受け取りました</h1><p>このタブを閉じてください。</p>".encode("utf-8")
            )
            completed.set()

        def log_message(self, _format: str, *_args: object) -> None:
            return

    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    authorization_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(PROFILES[args.profile]),
        "access_type": "offline",
        "prompt": "consent",
        # 投稿用クライアント等で過去に許可した広い権限を分析tokenへ混在させない。
        "include_granted_scopes": "false",
        "state": state,
    })
    print(json.dumps({"authorization_url": authorization_url}, ensure_ascii=False), flush=True)
    if not completed.wait(timeout=600):
        server.shutdown()
        raise SystemExit("OAuth認可が10分以内に完了しませんでした。")
    server.shutdown()
    if result.get("error"):
        raise SystemExit(f"OAuth認可が拒否されました: {result['error']}")

    payload = exchange_token(
        client_id=client_id,
        client_secret=client_secret,
        code=result["code"],
        redirect_uri=redirect_uri,
    )
    print(json.dumps({
        "profile": args.profile,
        "refresh_token": payload.get("refresh_token"),
        "scope": payload.get("scope"),
    }, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

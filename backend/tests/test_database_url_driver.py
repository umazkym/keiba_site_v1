"""DB接続URLのドライバ指定の検査。

SQLAlchemy 2.1 から「postgresql://」の既定ドライバが psycopg（v3）に変わり、
依存に入っていない psycopg を読みに行って API（Cloud Run）と定時処理が起動できなくなった（2026-09-25）。
database.py がドライバ指定のないURLを psycopg2 に揃えることを、環境変数を変えた別プロセスで確かめる
（database.py は読み込み時に接続の設定を作るため）。接続はしない。
"""
import os
import subprocess
import sys
import unittest
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]


def _driver_for(url: str) -> str:
    env = {key: value for key, value in os.environ.items() if key not in ('K_SERVICE', 'GITHUB_ACTIONS')}
    env['DATABASE_URL'] = url
    result = subprocess.run(
        [sys.executable, '-c', 'from database import database as d; print(d.engine.url.drivername)'],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip().splitlines()[-1]


class DatabaseUrlDriverTest(unittest.TestCase):
    def test_plain_postgres_urls_use_psycopg2(self) -> None:
        for url in ('postgresql://u:p@127.0.0.1:5999/db', 'postgres://u:p@127.0.0.1:5999/db'):
            self.assertEqual(_driver_for(url), 'postgresql+psycopg2', url)

    def test_explicit_driver_is_kept(self) -> None:
        self.assertEqual(_driver_for('postgresql+psycopg2://u:p@127.0.0.1:5999/db'), 'postgresql+psycopg2')

    def test_requirements_stay_on_sqlalchemy_2_0(self) -> None:
        for name in ('requirements.txt', 'requirements-api.txt'):
            text = (BACKEND_DIR / name).read_text(encoding='utf-8')
            self.assertIn('sqlalchemy>=2.0,<2.1', text, name)


if __name__ == '__main__':
    unittest.main()

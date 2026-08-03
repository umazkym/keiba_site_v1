"""段階公開状態テーブルをIAP経由で冪等作成する。"""

from __future__ import annotations

import argparse

from sqlalchemy import inspect

from database import models
from database.database import Base, engine


TABLE_NAME = models.DataPagePublication.__tablename__


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    before = TABLE_NAME in inspect(engine).get_table_names()
    if args.dry_run:
        print(f"{TABLE_NAME}: {'exists' if before else 'missing'}")
        return 0

    Base.metadata.create_all(
        bind=engine,
        tables=[models.DataPagePublication.__table__],
        checkfirst=True,
    )
    after = TABLE_NAME in inspect(engine).get_table_names()
    if not after:
        raise RuntimeError(f"{TABLE_NAME}の作成確認に失敗しました")
    print(f"{TABLE_NAME}: {'already existed' if before else 'created'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

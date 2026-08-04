"""API起動時のschema自動作成をローカルSQLiteだけへ限定する。"""

from __future__ import annotations


TRUE_VALUES = {"1", "true", "yes", "on"}
FALSE_VALUES = {"0", "false", "no", "off"}


def schema_creation_enabled(
    *,
    dialect_name: str,
    configured_value: str | None,
) -> bool:
    """明示値を優先し、未設定時はSQLiteだけを許可する。"""

    if configured_value is None or not configured_value.strip():
        return dialect_name.lower() == "sqlite"
    normalized = configured_value.strip().lower()
    if normalized in TRUE_VALUES:
        return True
    if normalized in FALSE_VALUES:
        return False
    raise RuntimeError(
        "ALLOW_SCHEMA_CREATEはtrue/false、1/0、yes/no、on/offのいずれかで指定してください"
    )

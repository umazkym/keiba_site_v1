"""重賞日程から年度をまたいで安定する内部識別子を解決する。"""

from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import dataclass
from typing import Any, Mapping, Sequence


GRADE_RACE_IDENTITY_VERSION = "v1"
GRADE_RACE_CIRCUITS = frozenset({"jra", "nar", "overseas"})
TRUSTED_GRADE_RACE_SCHEDULE_SOURCES = frozenset({"jra", "jra_local", "nar", "fallback"})


@dataclass(frozen=True)
class GradeRaceIdentityResolution:
    entity_key: str
    source: str
    circuit: str
    normalized_name: str
    archive_slug: str = ""
    error: str = ""

    @property
    def resolved(self) -> bool:
        return bool(self.entity_key and not self.error)

    @property
    def entity_path(self) -> str:
        return f"/articles/grade-races/{self.archive_slug}" if self.archive_slug else ""


def normalize_grade_race_identity_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", str(value or ""))
    normalized = re.sub(r"20\d{2}年?", "", normalized)
    return re.sub(r"[\s　・･（）()【】「」『』｜|:：_\-]", "", normalized).lower()


def normalize_grade_race_circuit(value: str) -> str:
    normalized = str(value or "").strip().lower()
    return normalized if normalized in GRADE_RACE_CIRCUITS else ""


def deterministic_grade_race_entity_key(race_name: str, circuit: str) -> str:
    normalized_name = normalize_grade_race_identity_text(race_name)
    normalized_circuit = normalize_grade_race_circuit(circuit)
    if not normalized_name or not normalized_circuit:
        return ""
    material = f"{GRADE_RACE_IDENTITY_VERSION}|{normalized_circuit}|{normalized_name}"
    digest = hashlib.sha256(material.encode("utf-8")).hexdigest()[:16]
    return f"auto-{normalized_circuit}-{digest}"


def _registry_matches(
    registry: Sequence[Mapping[str, Any]],
    race_name: str,
    circuit: str,
) -> list[Mapping[str, Any]]:
    target = normalize_grade_race_identity_text(race_name)
    rows: list[Mapping[str, Any]] = []
    for row in registry:
        row_circuit = normalize_grade_race_circuit(str(row.get("circuit") or ""))
        if circuit and row_circuit != circuit:
            continue
        aliases = [row.get("name"), *(row.get("aliases") or [])]
        if any(normalize_grade_race_identity_text(str(alias or "")) == target for alias in aliases):
            rows.append(row)
    return rows


def resolve_grade_race_identity(
    race_name: str,
    circuit: str,
    *,
    trusted_schedule: bool,
    registry: Sequence[Mapping[str, Any]],
) -> GradeRaceIdentityResolution:
    """共有台帳を優先し、信頼済み日程だけ決定的な内部キーへフォールバックする。"""
    normalized_name = normalize_grade_race_identity_text(race_name)
    normalized_circuit = normalize_grade_race_circuit(circuit)
    if not normalized_name:
        return GradeRaceIdentityResolution("", "unresolved", normalized_circuit, "", error="empty_race_name")
    if not normalized_circuit:
        return GradeRaceIdentityResolution(
            "",
            "unresolved",
            "",
            normalized_name,
            error="invalid_circuit",
        )

    matches = _registry_matches(registry, race_name, normalized_circuit)
    unique_matches = {
        str(row.get("entity_key") or "").strip(): row
        for row in matches
        if str(row.get("entity_key") or "").strip()
    }
    if len(unique_matches) == 1:
        entity_key, row = next(iter(unique_matches.items()))
        archive_slug = str(row.get("archive_slug") or entity_key).strip()
        return GradeRaceIdentityResolution(
            entity_key=entity_key,
            source="curated_registry",
            circuit=normalized_circuit,
            normalized_name=normalized_name,
            archive_slug=archive_slug,
        )
    if len(unique_matches) > 1:
        return GradeRaceIdentityResolution(
            "",
            "unresolved",
            normalized_circuit,
            normalized_name,
            error="ambiguous_registry_alias",
        )
    if not trusted_schedule:
        return GradeRaceIdentityResolution(
            "",
            "unresolved",
            normalized_circuit,
            normalized_name,
            error="untrusted_schedule_fallback",
        )

    entity_key = deterministic_grade_race_entity_key(race_name, normalized_circuit)
    if not entity_key:
        return GradeRaceIdentityResolution(
            "",
            "unresolved",
            normalized_circuit,
            normalized_name,
            error="deterministic_key_failed",
        )
    return GradeRaceIdentityResolution(
        entity_key=entity_key,
        source="deterministic_schedule",
        circuit=normalized_circuit,
        normalized_name=normalized_name,
    )

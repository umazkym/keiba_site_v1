import os
from dataclasses import dataclass


def _get_env(name: str) -> str:
    return (os.getenv(name) or "").strip()


def _mask(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 8:
        return "*" * len(value)
    return f"{value[:4]}...{value[-4:]}"


@dataclass(frozen=True)
class RakutenApiSettings:
    application_url: str
    application_id: str
    access_key: str
    affiliate_id: str

    @property
    def is_configured(self) -> bool:
        return all([
            self.application_url,
            self.application_id,
            self.access_key,
            self.affiliate_id,
        ])

    def masked_summary(self) -> dict[str, str | bool]:
        return {
            "application_url": self.application_url,
            "application_id": _mask(self.application_id),
            "access_key": _mask(self.access_key),
            "affiliate_id": _mask(self.affiliate_id),
            "is_configured": self.is_configured,
        }


def get_rakuten_api_settings() -> RakutenApiSettings:
    return RakutenApiSettings(
        application_url=_get_env("RAKUTEN_API_APPLICATION_URL"),
        application_id=_get_env("RAKUTEN_API_APPLICATION_ID"),
        access_key=_get_env("RAKUTEN_API_ACCESS_KEY"),
        affiliate_id=_get_env("RAKUTEN_AFFILIATE_ID"),
    )

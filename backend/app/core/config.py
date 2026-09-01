"""Application configuration loaded from environment variables.

Required (fail-fast):
    JWT_SECRET, ADMIN_BOOTSTRAP_USER, ADMIN_BOOTSTRAP_PASSWORD_HASH

Optional (with defaults):
    DIAG_RETENTION_DAYS, AUDIT_RETENTION_DAYS, REVOKED_TOKEN_RETENTION_DAYS,
    ACCESS_TOKEN_TTL_MIN, REFRESH_TOKEN_TTL_HOURS, CLEANUP_CRON_HOUR

Con chính sách: KHONG hard-code con số retention/TTL trong code.
Đọc từ env để dễ chuyển POC -> production (audit 2-3 năm khi cần).
"""
from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ====== Required (fail-fast) ======
    JWT_SECRET: str = Field(...)

    @field_validator("JWT_SECRET")
    @classmethod
    def _jwt_secret_min_length(cls, v: str) -> str:
        if len(v.encode("utf-8")) < 32:
            raise ValueError("JWT_SECRET must be at least 32 bytes")
        return v

    ADMIN_BOOTSTRAP_USER: str = Field(...)
    ADMIN_BOOTSTRAP_PASSWORD_HASH: str = Field(...)

    # ====== Database ======
    DATABASE_URL: str = Field(default="postgresql+psycopg2://iigw:iigw@postgres:5432/iigw")
    INFLUXDB_URL: str = Field(default="http://influxdb:8086")
    INFLUXDB_TOKEN: str = Field(default="")
    INFLUXDB_ORG: str = Field(default="iigw")
    INFLUXDB_BUCKET: str = Field(default="telemetry")

    # ====== MQTT ======
    MQTT_BROKER_HOST: str = Field(default="emqx")
    MQTT_BROKER_PORT: int = Field(default=1883)

    # ====== Multi-instance (M9) ======
    REDIS_URL: str = Field(default="")  # empty => single-instance mode
    INSTANCE_ID: str = Field(default="backend-1")  # unique per pod

    # ====== Optional with defaults ======
    DIAG_RETENTION_DAYS: int = Field(default=90, ge=1)
    AUDIT_RETENTION_DAYS: int = Field(default=365, ge=1)
    REVOKED_TOKEN_RETENTION_DAYS: int = Field(default=30, ge=1)
    ACCESS_TOKEN_TTL_MIN: int = Field(default=15, ge=1)
    REFRESH_TOKEN_TTL_HOURS: int = Field(default=8, ge=1)
    CLEANUP_CRON_HOUR: int = Field(default=2, ge=0, le=23)

    # ====== App ======
    APP_ENV: str = Field(default="dev")
    CORS_ORIGINS: str = Field(default="http://localhost:5173")
    COOKIE_SECURE: bool = Field(default=False)
    EXPORT_MAX_ROWS: int = Field(default=100_000, ge=1)

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def access_token_ttl_sec(self) -> int:
        return self.ACCESS_TOKEN_TTL_MIN * 60

    @property
    def refresh_token_ttl_sec(self) -> int:
        return self.REFRESH_TOKEN_TTL_HOURS * 3600


@lru_cache
def get_settings() -> Settings:
    return Settings()

"""SQLAlchemy ORM models.

Schema (Postgres):
  - device_sources: mapping device_id <-> source (override pattern)
  - device_diag:    diag history (per spec 7.2, not stored in InfluxDB)
  - users:          admin / viewer accounts (bcrypt-hashed)
  - audit_log:      every privileged action
  - revoked_refresh: refresh-token JTI blacklist
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Double,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    PrimaryKeyConstraint,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


# =================== device_sources ===================
class DeviceSource(Base):
    __tablename__ = "device_sources"

    device_id: Mapped[str] = mapped_column(Text, primary_key=True)
    source: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_by: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "source IN ('simulated','real')",
            name="ck_device_sources_source",
        ),
    )


# =================== device_diag ===================
class DeviceDiag(Base):
    __tablename__ = "device_diag"

    device_id: Mapped[str] = mapped_column(Text, nullable=False)
    ts: Mapped[int] = mapped_column(BigInteger, nullable=False)
    poll_cycle_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    uptime_s: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    tx_packets: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    tx_failures: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    mqtt_reconnect: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    avg_latency_ms: Mapped[Optional[float]] = mapped_column(Double, nullable=True)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)

    __table_args__ = (
        PrimaryKeyConstraint("device_id", "ts", name="pk_device_diag"),
        Index("idx_diag_ts", "ts", postgresql_using="brin"),
        Index("idx_diag_device_ts", "device_id", "ts"),
    )


# =================== users ===================
class User(Base):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(Text, primary_key=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        CheckConstraint(
            "role IN ('admin','viewer')",
            name="ck_users_role",
        ),
    )


# =================== audit_log ===================
class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ts: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    user_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    action: Mapped[str] = mapped_column(Text, nullable=False)
    target: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    detail: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    __table_args__ = (
        Index("idx_audit_ts", "ts"),
    )


# =================== revoked_refresh ===================
class RevokedRefresh(Base):
    __tablename__ = "revoked_refresh"

    jti: Mapped[str] = mapped_column(Text, primary_key=True)
    user_name: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    revoked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        Index("idx_revoked_expires", "expires_at"),
    )

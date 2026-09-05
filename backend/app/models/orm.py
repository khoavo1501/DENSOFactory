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


# =================== gateways (M10) ===================
class Gateway(Base):
    """A gateway (STM32 + W5500) that owns one or more PLCs.

    `gateway_id` is the MQTT topic segment `devices/{gateway_id}/...`
    (the `device_id` envelope field; same identifier, different name in
    the DB to disambiguate from PLCs which live under the gateway).
    Auto-created by the MQTT consumer on first message.
    """

    __tablename__ = "gateways"

    gateway_id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="offline")
    fw_version: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ip: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_seen_ts: Mapped[Optional[int]] = mapped_column(
        BigInteger, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    plcs: Mapped[list["PLC"]] = relationship(
        "PLC",
        back_populates="gateway",
        cascade="all, delete-orphan",
        foreign_keys="PLC.gateway_id",
    )
    assignments: Mapped[list["PLCAssignment"]] = relationship(
        "PLCAssignment",
        back_populates="gateway",
        cascade="all, delete-orphan",
        foreign_keys="PLCAssignment.gateway_id",
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('online','offline','error')",
            name="ck_gateways_status",
        ),
    )


# =================== plcs (M10) ===================
class PLC(Base):
    """A PLC (Programmable Logic Controller, Modbus slave) that reports
    to a gateway.

    `gateway_id` references `gateways.gateway_id`. Created and updated
    by the MQTT consumer (or via the admin `pair` endpoint).
    """

    __tablename__ = "plcs"

    plc_id: Mapped[str] = mapped_column(Text, primary_key=True)
    gateway_id: Mapped[str] = mapped_column(
        Text,
        ForeignKey("gateways.gateway_id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    operating_status: Mapped[str] = mapped_column(
        Text, nullable=False, default="stopped"
    )
    status: Mapped[str] = mapped_column(
        Text, nullable=False, default="offline"
    )
    last_seen_ts: Mapped[Optional[int]] = mapped_column(
        BigInteger, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    gateway: Mapped[Gateway] = relationship(
        "Gateway",
        back_populates="plcs",
        foreign_keys=[gateway_id],
    )
    snapshots: Mapped[list["PLCSnapshot"]] = relationship(
        "PLCSnapshot",
        back_populates="plc",
        cascade="all, delete-orphan",
        foreign_keys="PLCSnapshot.plc_id",
    )
    assignments: Mapped[list["PLCAssignment"]] = relationship(
        "PLCAssignment",
        back_populates="plc",
        cascade="all, delete-orphan",
        foreign_keys="PLCAssignment.plc_id",
    )

    __table_args__ = (
        CheckConstraint(
            "operating_status IN ('running','stopped')",
            name="ck_plcs_operating",
        ),
        CheckConstraint(
            "status IN ('online','offline','error')",
            name="ck_plcs_status",
        ),
    )


# =================== plc_snapshots (M10) ===================
class PLCSnapshot(Base):
    """Time-series of live telemetry snapshots per PLC.

    A new row is inserted by the consumer each time a telemetry message
    arrives (or at most once per heartbeat interval). The webapp reads
    `plc_snapshots` for the latest values and the gateways API serves
    the most recent one.
    """

    __tablename__ = "plc_snapshots"

    id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True
    )
    plc_id: Mapped[str] = mapped_column(
        Text,
        ForeignKey("plcs.plc_id", ondelete="CASCADE"),
        nullable=False,
    )
    gateway_id: Mapped[str] = mapped_column(Text, nullable=False)
    ts: Mapped[int] = mapped_column(BigInteger, nullable=False)
    temperature: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True
    )
    rpm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    current_amp: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True
    )
    heartbeat: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    operating_status: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )
    status: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    mode: Mapped[str] = mapped_column(
        Text, nullable=False, default="normal"
    )

    plc: Mapped[PLC] = relationship(
        "PLC",
        back_populates="snapshots",
        foreign_keys=[plc_id],
    )

    __table_args__ = (
        Index("ix_plc_snapshots_plc_ts", "plc_id", "ts"),
        CheckConstraint(
            "mode IN ('normal','realtime')",
            name="ck_plc_snapshots_mode",
        ),
    )


# =================== plc_assignments (M10) ===================
class PLCAssignment(Base):
    """A pairing record: PLC assigned to a gateway.

    The `plc_assignments_plc_id_key` UNIQUE constraint means a PLC can
    be assigned to at most one gateway at a time. Re-pairing deletes
    the previous row (handled in the API).
    """

    __tablename__ = "plc_assignments"

    id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True
    )
    plc_id: Mapped[str] = mapped_column(
        Text,
        ForeignKey("plcs.plc_id", ondelete="CASCADE"),
        nullable=False,
    )
    gateway_id: Mapped[str] = mapped_column(
        Text,
        ForeignKey("gateways.gateway_id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    plc: Mapped[PLC] = relationship(
        "PLC",
        back_populates="assignments",
        foreign_keys=[plc_id],
    )
    gateway: Mapped[Gateway] = relationship(
        "Gateway",
        back_populates="assignments",
        foreign_keys=[gateway_id],
    )

    __table_args__ = (
        Index("plc_assignments_plc_id_key", "plc_id", unique=True),
    )


# =================== warnings (M10) ===================
class Warning(Base):
    """Active or historical warning tied to a gateway or PLC.

    `cleared=0` means active. Set to non-zero (ts) when cleared.
    """

    __tablename__ = "warnings"

    id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True
    )
    target_type: Mapped[str] = mapped_column(Text, nullable=False)
    target_id: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(Text, nullable=False)
    code: Mapped[str] = mapped_column(Text, nullable=False)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ts: Mapped[int] = mapped_column(BigInteger, nullable=False)
    cleared: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)

    __table_args__ = (
        Index("ix_warnings_target", "target_type", "target_id"),
        Index("ix_warnings_ts", "ts"),
        CheckConstraint(
            "severity IN ('info','warning','critical')",
            name="ck_warnings_severity",
        ),
        CheckConstraint(
            "target_type IN ('plc','gateway')",
            name="ck_warnings_target_type",
        ),
    )

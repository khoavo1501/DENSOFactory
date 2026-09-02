"""M10 ORM models: Gateway, PLC, PLCSnapshot, PLCAssignment, Warning."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Gateway(Base):
    __tablename__ = "gateways"

    master_id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="offline", nullable=False)
    fw_version: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ip: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    last_seen_ts: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('online','offline','error')",
            name="ck_gateways_status",
        ),
    )


class PLC(Base):
    __tablename__ = "plcs"

    plc_id: Mapped[str] = mapped_column(String, primary_key=True)
    master_id: Mapped[str] = mapped_column(
        String, ForeignKey("gateways.master_id"), nullable=False
    )
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    operating_status: Mapped[str] = mapped_column(
        String, default="stopped", nullable=False
    )
    status: Mapped[str] = mapped_column(String, default="offline", nullable=False)
    last_seen_ts: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            "operating_status IN ('running','stopped')",
            name="ck_plcs_operating",
        ),
        CheckConstraint(
            "status IN ('online','offline','error')", name="ck_plcs_status"
        ),
    )


class PLCSnapshot(Base):
    """Periodic snapshot of PLC values (1 per minute default, or realtime)."""

    __tablename__ = "plc_snapshots"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    plc_id: Mapped[str] = mapped_column(String, nullable=False)
    master_id: Mapped[str] = mapped_column(String, nullable=False)
    ts: Mapped[int] = mapped_column(BigInteger, nullable=False)
    temperature: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rpm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    current_amp: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    heartbeat: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    operating_status: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    mode: Mapped[str] = mapped_column(String, default="normal", nullable=False)

    __table_args__ = (
        CheckConstraint(
            "mode IN ('normal','realtime')", name="ck_plc_snapshots_mode"
        ),
        Index("ix_plc_snapshots_plc_ts", "plc_id", "ts"),
    )


class PLCAssignment(Base):
    """Pair a PLC to a gateway for management UI.

    PLC may publish via any gateway (master_id) but the UI groups
    them by this assignment for display.
    """

    __tablename__ = "plc_assignments"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    plc_id: Mapped[str] = mapped_column(
        String, ForeignKey("plcs.plc_id"), nullable=False, unique=True
    )
    gateway_id: Mapped[str] = mapped_column(
        String, ForeignKey("gateways.master_id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Warning(Base):
    __tablename__ = "warnings"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    target_type: Mapped[str] = mapped_column(String, nullable=False)
    target_id: Mapped[str] = mapped_column(String, nullable=False)
    severity: Mapped[str] = mapped_column(String, nullable=False)
    code: Mapped[str] = mapped_column(String, nullable=False)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ts: Mapped[int] = mapped_column(BigInteger, nullable=False)
    cleared: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "target_type IN ('plc','gateway')", name="ck_warnings_target_type"
        ),
        CheckConstraint(
            "severity IN ('info','warning','critical')",
            name="ck_warnings_severity",
        ),
        Index("ix_warnings_target", "target_type", "target_id"),
        Index("ix_warnings_ts", "ts"),
    )

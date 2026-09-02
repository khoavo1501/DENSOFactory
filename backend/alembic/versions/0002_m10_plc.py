"""M10: gateways, plcs, plc_snapshots, plc_assignments, warnings

Revision ID: 0002_m10_plc
Revises: 0001_initial
Create Date: 2026-09-02
"""
from alembic import op
import sqlalchemy as sa


revision = "0002_m10_plc"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "gateways",
        sa.Column("master_id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column(
            "status",
            sa.String(),
            nullable=False,
            server_default="offline",
        ),
        sa.Column("fw_version", sa.String(), nullable=True),
        sa.Column("ip", sa.String(), nullable=True),
        sa.Column("last_seen_ts", sa.BigInteger(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "status IN ('online','offline','error')",
            name="ck_gateways_status",
        ),
    )

    op.create_table(
        "plcs",
        sa.Column("plc_id", sa.String(), primary_key=True),
        sa.Column(
            "master_id",
            sa.String(),
            sa.ForeignKey("gateways.master_id"),
            nullable=False,
        ),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column(
            "operating_status",
            sa.String(),
            nullable=False,
            server_default="stopped",
        ),
        sa.Column(
            "status",
            sa.String(),
            nullable=False,
            server_default="offline",
        ),
        sa.Column("last_seen_ts", sa.BigInteger(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "operating_status IN ('running','stopped')",
            name="ck_plcs_operating",
        ),
        sa.CheckConstraint(
            "status IN ('online','offline','error')", name="ck_plcs_status"
        ),
    )

    op.create_table(
        "plc_snapshots",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("plc_id", sa.String(), nullable=False),
        sa.Column("master_id", sa.String(), nullable=False),
        sa.Column("ts", sa.BigInteger(), nullable=False),
        sa.Column("temperature", sa.Float(), nullable=True),
        sa.Column("rpm", sa.Float(), nullable=True),
        sa.Column("current_amp", sa.Float(), nullable=True),
        sa.Column("heartbeat", sa.BigInteger(), nullable=True),
        sa.Column("operating_status", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column(
            "mode",
            sa.String(),
            nullable=False,
            server_default="normal",
        ),
        sa.CheckConstraint(
            "mode IN ('normal','realtime')", name="ck_plc_snapshots_mode"
        ),
    )
    op.create_index(
        "ix_plc_snapshots_plc_ts", "plc_snapshots", ["plc_id", "ts"]
    )

    op.create_table(
        "plc_assignments",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "plc_id",
            sa.String(),
            sa.ForeignKey("plcs.plc_id"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "gateway_id",
            sa.String(),
            sa.ForeignKey("gateways.master_id"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_table(
        "warnings",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("target_type", sa.String(), nullable=False),
        sa.Column("target_id", sa.String(), nullable=False),
        sa.Column("severity", sa.String(), nullable=False),
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("ts", sa.BigInteger(), nullable=False),
        sa.Column(
            "cleared", sa.BigInteger(), nullable=False, server_default="0"
        ),
        sa.CheckConstraint(
            "target_type IN ('plc','gateway')", name="ck_warnings_target_type"
        ),
        sa.CheckConstraint(
            "severity IN ('info','warning','critical')",
            name="ck_warnings_severity",
        ),
    )
    op.create_index(
        "ix_warnings_target", "warnings", ["target_type", "target_id"]
    )
    op.create_index("ix_warnings_ts", "warnings", ["ts"])


def downgrade() -> None:
    op.drop_index("ix_warnings_ts", table_name="warnings")
    op.drop_index("ix_warnings_target", table_name="warnings")
    op.drop_table("warnings")
    op.drop_table("plc_assignments")
    op.drop_index("ix_plc_snapshots_plc_ts", table_name="plc_snapshots")
    op.drop_table("plc_snapshots")
    op.drop_table("plcs")
    op.drop_table("gateways")

"""initial schema: device_sources, device_diag, users, audit_log, revoked_refresh

Revision ID: 0001_initial
Revises:
Create Date: 2026-08-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # device_sources
    op.create_table(
        "device_sources",
        sa.Column("device_id", sa.Text(), primary_key=True),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_by", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "source IN ('simulated','real')",
            name="ck_device_sources_source",
        ),
    )

    # device_diag
    op.create_table(
        "device_diag",
        sa.Column("device_id", sa.Text(), nullable=False),
        sa.Column("ts", sa.BigInteger(), nullable=False),
        sa.Column("poll_cycle_ms", sa.Integer(), nullable=True),
        sa.Column("uptime_s", sa.BigInteger(), nullable=True),
        sa.Column("tx_packets", sa.BigInteger(), nullable=True),
        sa.Column("tx_failures", sa.BigInteger(), nullable=True),
        sa.Column("mqtt_reconnect", sa.BigInteger(), nullable=True),
        sa.Column("avg_latency_ms", sa.Double(), nullable=True),
        sa.Column("payload", JSONB, nullable=False),
        sa.PrimaryKeyConstraint("device_id", "ts", name="pk_device_diag"),
    )
    op.create_index(
        "idx_diag_device_ts", "device_diag", ["device_id", "ts"]
    )

    # users
    op.create_table(
        "users",
        sa.Column("username", sa.Text(), primary_key=True),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "role IN ('admin','viewer')",
            name="ck_users_role",
        ),
    )

    # audit_log
    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "ts",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("user_name", sa.Text(), nullable=True),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("target", sa.Text(), nullable=True),
        sa.Column("detail", JSONB, nullable=True),
    )
    op.create_index("idx_audit_ts", "audit_log", ["ts"])

    # revoked_refresh
    op.create_table(
        "revoked_refresh",
        sa.Column("jti", sa.Text(), primary_key=True),
        sa.Column("user_name", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "revoked_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "idx_revoked_expires", "revoked_refresh", ["expires_at"]
    )


def downgrade() -> None:
    op.drop_index("idx_revoked_expires", table_name="revoked_refresh")
    op.drop_table("revoked_refresh")
    op.drop_index("idx_audit_ts", table_name="audit_log")
    op.drop_table("audit_log")
    op.drop_table("users")
    op.drop_index("idx_diag_device_ts", table_name="device_diag")
    op.drop_table("device_diag")
    op.drop_table("device_sources")

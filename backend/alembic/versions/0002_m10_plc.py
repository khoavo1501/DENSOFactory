"""M10: gateways, plcs, plc_snapshots, plc_assignments, warnings

The original M10 schema was already created directly in Postgres (during
prior development of M10 work that was never committed). This migration
is a no-op schema-wise; it just advances the alembic version pointer so
future migrations have a proper parent.

Revision ID: 0002_m10_plc
Revises: 0001_initial
Create Date: 2026-09-05
"""
from alembic import op


revision = "0002_m10_plc"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tables `gateways`, `plcs`, `plc_snapshots`, `plc_assignments`,
    # `warnings` already exist in the live database from prior work.
    # See backend/app/models/orm.py for the SQLAlchemy mapping.
    pass


def downgrade() -> None:
    # Don't drop the M10 tables in downgrade — they're live production
    # data. To roll back M10, do it manually.
    pass

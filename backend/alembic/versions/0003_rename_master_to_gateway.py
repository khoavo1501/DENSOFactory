"""Rename master_id -> gateway_id in M10 tables.

Vocabulary change per payload spec v1.1: 'gateway' = STM32+W5500,
'plc' = Modbus slave. Affects 4 tables:

  - gateways.master_id        -> gateways.gateway_id (PK)
  - plcs.master_id            -> plcs.gateway_id     (FK)
  - plc_snapshots.master_id   -> plc_snapshots.gateway_id
  - plc_assignments.gateway_id already had this name (no change)

FK constraints referencing the renamed column are dropped and
recreated to point at the new column name. No data is migrated —
the existing values are preserved (text stays text).

Revision ID: 0003_rename_master_to_gateway
Revises: 0002_m10_plc
Create Date: 2026-09-05
"""
from alembic import op


revision = "0003_rename_master_to_gateway"
down_revision = "0002_m10_plc"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Rename the PK column on `gateways`.
    op.alter_column(
        "gateways",
        "master_id",
        new_column_name="gateway_id",
    )

    # 2. Drop the FK constraint from `plcs` -> `gateways.master_id`,
    #    rename the column on `plcs`, then recreate the FK.
    op.drop_constraint(
        "plcs_master_id_fkey",
        "plcs",
        type_="foreignkey",
    )
    op.alter_column(
        "plcs",
        "master_id",
        new_column_name="gateway_id",
    )
    op.create_foreign_key(
        "plcs_gateway_id_fkey",
        "plcs",
        "gateways",
        ["gateway_id"],
        ["gateway_id"],
        ondelete="CASCADE",
    )

    # 3. Rename the denormalised column on `plc_snapshots`
    #    (no FK constraint to drop — the original M10 schema didn't
    #    declare one; `gateway_id` is purely denormalised here).
    op.alter_column(
        "plc_snapshots",
        "master_id",
        new_column_name="gateway_id",
    )

    # 4. `plc_assignments.gateway_id` already uses the new name;
    #    only the FK target changed in step 1. Drop + recreate it.
    op.drop_constraint(
        "plc_assignments_gateway_id_fkey",
        "plc_assignments",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "plc_assignments_gateway_id_fkey",
        "plc_assignments",
        "gateways",
        ["gateway_id"],
        ["gateway_id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    # Reverse order: plc_assignments, plc_snapshots, plcs, gateways.
    op.drop_constraint(
        "plc_assignments_gateway_id_fkey",
        "plc_assignments",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "plc_assignments_gateway_id_fkey",
        "plc_assignments",
        "gateways",
        ["gateway_id"],
        ["master_id"],
        ondelete="CASCADE",
    )

    op.alter_column(
        "plc_snapshots",
        "gateway_id",
        new_column_name="master_id",
    )

    op.drop_constraint(
        "plcs_gateway_id_fkey",
        "plcs",
        type_="foreignkey",
    )
    op.alter_column(
        "plcs",
        "gateway_id",
        new_column_name="master_id",
    )
    op.create_foreign_key(
        "plcs_master_id_fkey",
        "plcs",
        "gateways",
        ["master_id"],
        ["master_id"],
        ondelete="CASCADE",
    )

    op.alter_column(
        "gateways",
        "gateway_id",
        new_column_name="master_id",
    )
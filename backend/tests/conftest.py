"""Pytest conftest: force env vars BEFORE any app import.

This must be loaded before any test module that imports app.*.
"""
import os

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg2://iigw:iigw@postgres:5432/iigw",
)
os.environ.setdefault("JWT_SECRET", "x" * 40)
os.environ.setdefault("ADMIN_BOOTSTRAP_USER", "admin")
os.environ.setdefault(
    "ADMIN_BOOTSTRAP_PASSWORD_HASH",
    "$2b$12$Ny9RKVs4KOxAUAUJOPQjTuuQVvN4q3rtgKBjBnhc7nZ0JTxST.MlO",
)
os.environ.setdefault("INFLUXDB_TOKEN", "")
os.environ.setdefault("MQTT_BROKER_HOST", "127.0.0.1")
os.environ.setdefault("MQTT_BROKER_PORT", "1883")
os.environ.setdefault("CLEANUP_CRON_HOUR", "2")
os.environ["APP_ENV"] = "test"  # skip MQTT consumer in lifespan

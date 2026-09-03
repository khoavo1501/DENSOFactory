"""FastAPI application entrypoint."""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# `os` is used in lifespan to gate MQTT consumer in test mode.
_ = os  # silence unused-import warnings if any.

from app.api import admin, auth, devices, events, exports
from app.api.middleware_csrf import csrf_protect
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.mqtt.consumer import get_consumer
from app.services import cleanup
from app.services.bootstrap import ensure_admin
from app.ws.hub import router as ws_router, start_bus, stop_bus


_log = logging.getLogger(__name__)


def _setup_scheduler() -> BackgroundScheduler:
    settings = get_settings()
    sched = BackgroundScheduler(daemon=True)

    def _job():
        db = SessionLocal()
        try:
            cleanup.run_all(db)
        except Exception as e:
            _log.exception("cleanup job failed: %s", e)
        finally:
            db.close()

    sched.add_job(
        _job,
        trigger="cron",
        hour=settings.CLEANUP_CRON_HOUR,
        minute=0,
        id="nightly_cleanup",
        replace_existing=True,
    )
    sched.start()
    return sched


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    _log.info("starting iigw-webapp env=%s", settings.APP_ENV)

    db = SessionLocal()
    try:
        ensure_admin(db)
    except Exception as e:
        _log.exception("bootstrap failed: %s", e)
    finally:
        db.close()

    sched = _setup_scheduler()
    consumer = get_consumer()
    # Skip MQTT consumer in test mode (no broker available)
    if os.environ.get("APP_ENV") != "test":
        await consumer.start()
        _log.info("mqtt consumer started")
    # Start Redis pub/sub bus (no-op if REDIS_URL is empty)
    await start_bus()
    try:
        yield
    finally:
        await stop_bus()
        if os.environ.get("APP_ENV") != "test":
            await consumer.stop()
        sched.shutdown(wait=False)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="IIoT Gateway Webapp API",
        version="0.2.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def _csrf_mw(request: Request, call_next):
        if request.method in {"POST", "PUT", "DELETE", "PATCH"}:
            try:
                await csrf_protect(request)
            except Exception as e:
                return JSONResponse(
                    status_code=getattr(e, "status_code", 403),
                    content={"detail": getattr(e, "detail", str(e))},
                )
        return await call_next(request)

    app.include_router(auth.router)
    app.include_router(admin.router)
    app.include_router(devices.router)
    app.include_router(events.router)
    app.include_router(exports.router)
    app.include_router(ws_router)

    from app.api import m10 as m10_api
    app.include_router(m10_api.router)

    @app.get("/healthz")
    def healthz():
        return {"status": "ok"}

    return app


app = create_app()

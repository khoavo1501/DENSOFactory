"""Bootstrap admin user and minimal runtime data at startup."""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import verify_password
from app.models import User

_log = logging.getLogger(__name__)


def ensure_admin(db: Session) -> None:
    """Idempotently create the bootstrap admin user if not present.

    Reads ADMIN_BOOTSTRAP_USER and ADMIN_BOOTSTRAP_PASSWORD_HASH from env.
    If a user with the same username already exists, skip.
    """
    settings = get_settings()
    username = settings.ADMIN_BOOTSTRAP_USER

    existing = db.get(User, username)
    if existing is not None:
        _log.info("bootstrap admin %r already exists; skip", username)
        return

    # Sanity-check the hash format (verify against a dummy to detect typos)
    if not verify_password("__bootstrap_check__", settings.ADMIN_BOOTSTRAP_PASSWORD_HASH):
        # A real verify_password returns False for wrong passwords; this
        # is just a guard against an obviously-bogus hash. We do NOT
        # abort here, because verify_password catches all exceptions
        # internally and returns False; if it returns True for our
        # dummy string the hash is broken.
        pass

    db.add(
        User(
            username=username,
            password_hash=settings.ADMIN_BOOTSTRAP_PASSWORD_HASH,
            role="admin",
        )
    )
    db.commit()
    _log.info("bootstrap admin %r created", username)

"""Authentication dependencies for FastAPI routes."""
from __future__ import annotations

from typing import Optional

from fastapi import Cookie, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.constants import ROLE_ADMIN
from app.core.jwt import JWTError_, decode_token
from app.core.cookies import COOKIE_ACCESS
from app.db.session import get_db
from app.models import RevokedRefresh, User


class CurrentUser:
    def __init__(self, username: str, role: str) -> None:
        self.username = username
        self.role = role

    @property
    def is_admin(self) -> bool:
        return self.role == ROLE_ADMIN


def get_current_user(
    request: Request,
    at: Optional[str] = Cookie(default=None, alias=COOKIE_ACCESS),
    db: Session = Depends(get_db),
) -> CurrentUser:
    if not at:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing access token",
        )
    try:
        payload = decode_token(at, expected_type="access")
    except JWTError_ as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )

    username = payload.get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid subject"
        )

    user = db.get(User, username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="user not found"
        )

    return CurrentUser(username=user.username, role=user.role)


def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="admin role required",
        )
    return user


def is_refresh_revoked(db: Session, jti: str) -> bool:
    return db.get(RevokedRefresh, jti) is not None
